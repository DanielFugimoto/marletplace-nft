import type { QueryClient } from '@tanstack/react-query'
import type { io as createSocket, Socket } from 'socket.io-client'
import {
  type Cart,
  type NftDetail,
  type NftListResponse,
  type NftUpdatedEvent,
  nftUpdatedEventSchema,
  type Order,
  type OrderUpdatedEvent,
  orderUpdatedEventSchema,
} from '@/api/contracts'
import { credentials } from '@/api/credentials'
import { queryKeys } from '@/api/query-keys'
import { env } from '@/env'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

export type RealtimeNotice =
  | {
      kind: 'nft-changed'
      nftId: string
      name: string
      inCart: boolean
      priceChanged: boolean
      previousPrice: string | null
      price: string
      soldOut: boolean
    }
  | { kind: 'order-updated'; orderId: string; status: Order['status'] }
  | { kind: 'reconnected' }

const MAX_SEEN_EVENTS = 500

/**
 * One socket per session. Responsibilities:
 * - drop duplicate events (by id) and stale ones (by resource version);
 * - ignore private events that don't belong to the current user;
 * - patch or invalidate TanStack Query caches;
 * - reconcile active resources with REST after a reconnection.
 */
class RealtimeClient {
  private socket: Socket | null = null
  private queryClient: QueryClient | null = null
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private hasConnectedOnce = false
  private generation = 0
  private status: RealtimeStatus = 'idle'
  private statusListeners = new Set<() => void>()
  private noticeListeners = new Set<(notice: RealtimeNotice) => void>()

  /**
   * socket.io-client is loaded on demand: it captures the global WebSocket at
   * import time, and loading it lazily lets the app bundle download in parallel
   * with the mock worker start-up (which patches WebSocket) without racing it.
   */
  connect(queryClient: QueryClient, token: string | null) {
    this.disconnect()
    this.queryClient = queryClient
    const generation = ++this.generation
    this.setStatus('connecting')
    void import('socket.io-client').then(({ io }) => {
      // A newer connect()/disconnect() happened while the module was loading.
      if (generation !== this.generation) return
      this.open(io, token)
    })
  }

  private open(io: typeof createSocket, token: string | null) {
    const socket = io(env.socketUrl, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
    })
    this.socket = socket

    socket.on('connect', () => {
      if (this.hasConnectedOnce) this.reconcile()
      this.hasConnectedOnce = true
      this.setStatus('connected')
    })
    socket.on('disconnect', () => this.setStatus('reconnecting'))
    socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'))
    socket.on('nft.updated', (payload: unknown) => this.receive(payload, 'nft'))
    socket.on('order.updated', (payload: unknown) => this.receive(payload, 'order'))
  }

  /** Releases the socket and forgets per-session dedupe state. */
  disconnect() {
    this.generation++
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.io.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.seen.clear()
    this.versions.clear()
    this.hasConnectedOnce = false
    this.setStatus('idle')
  }

  getStatus = () => this.status

  subscribeStatus = (listener: () => void) => {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  subscribeNotices(listener: (notice: RealtimeNotice) => void) {
    this.noticeListeners.add(listener)
    return () => {
      this.noticeListeners.delete(listener)
    }
  }

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) return
    this.status = status
    this.statusListeners.forEach((l) => l())
  }

  private notify(notice: RealtimeNotice) {
    this.noticeListeners.forEach((l) => l(notice))
  }

  /** Returns true when the event is new and not older than what we hold. */
  private accept(event: { id: string; resource: { type: string; id: string }; version: number }, knownVersion = 0) {
    if (this.seen.has(event.id)) return false
    this.seen.add(event.id)
    if (this.seen.size > MAX_SEEN_EVENTS) this.seen.delete(this.seen.values().next().value!)

    const key = `${event.resource.type}:${event.resource.id}`
    const current = Math.max(this.versions.get(key) ?? 0, knownVersion)
    if (event.version <= current) return false
    this.versions.set(key, event.version)
    return true
  }

  private receive(payload: unknown, kind: 'nft' | 'order') {
    if (kind === 'nft') {
      const parsed = nftUpdatedEventSchema.safeParse(payload)
      if (parsed.success) this.applyNft(parsed.data)
    } else {
      const parsed = orderUpdatedEventSchema.safeParse(payload)
      if (parsed.success) this.applyOrder(parsed.data)
    }
  }

  private applyNft(event: NftUpdatedEvent) {
    const qc = this.queryClient
    if (!qc) return
    const nftId = event.resource.id
    const detailKey = queryKeys.nfts.detail(nftId)
    const cachedDetail = qc.getQueryData<NftDetail>(detailKey)
    if (!this.accept(event, cachedDetail?.version)) return

    let previousPrice: string | null = cachedDetail?.price ?? null
    let name = cachedDetail?.name ?? ''

    qc.setQueryData<NftDetail>(detailKey, (detail) =>
      detail && detail.version < event.version
        ? {
            ...detail,
            price: event.data.price,
            compareAtPrice: event.data.compareAtPrice,
            soldOut: event.data.soldOut,
            version: event.version,
            editions: detail.editions.map((e) => {
              const update = event.data.editions.find((u) => u.id === e.id)
              return update ? { ...e, price: update.price, available: update.available } : e
            }),
          }
        : detail,
    )

    qc.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() }, (list) => {
      if (!list) return list
      return {
        ...list,
        items: list.items.map((item) => {
          if (item.id !== nftId || item.version >= event.version) return item
          previousPrice ??= item.price
          name ||= item.name
          return {
            ...item,
            price: event.data.price,
            compareAtPrice: event.data.compareAtPrice,
            soldOut: event.data.soldOut,
            version: event.version,
          }
        }),
      }
    })

    // Cart lines carry server-computed totals and issues: refetch rather than patch.
    const carts = qc.getQueriesData<Cart>({ queryKey: queryKeys.private })
    const cartItem = carts
      .flatMap(([key, data]) => (key.includes('cart') && data && 'items' in data ? data.items : []))
      .find((i) => i.nftId === nftId)
    if (cartItem) {
      previousPrice = cartItem.unitPrice
      name ||= cartItem.name
      void qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'private' && q.queryKey.includes('cart'),
      })
    }

    this.notify({
      kind: 'nft-changed',
      nftId,
      name: name || nftId,
      inCart: Boolean(cartItem),
      priceChanged: previousPrice !== null && previousPrice !== event.data.price,
      previousPrice,
      price: event.data.price,
      soldOut: event.data.soldOut,
    })
  }

  private applyOrder(event: OrderUpdatedEvent) {
    const qc = this.queryClient
    const userId = credentials.getSession()?.userId
    // Defense in depth: never let another session's event touch this user's data.
    if (!qc || !userId || event.data.userId !== userId) return
    const key = queryKeys.order(userId, event.resource.id)
    const cached = qc.getQueryData<Order>(key)
    if (!this.accept(event, cached?.version)) return

    qc.setQueryData<Order>(key, (order) =>
      order && order.version < event.version
        ? { ...order, status: event.data.status, failureReason: event.data.failureReason, version: event.version }
        : order,
    )
    // Fetch the full receipt (transaction, snapshot) and the updated cart.
    void qc.invalidateQueries({ queryKey: key })
    void qc.invalidateQueries({ queryKey: queryKeys.orders(userId), exact: true })
    if (event.data.status === 'confirmed') {
      void qc.invalidateQueries({ queryKey: queryKeys.cartRoot({ kind: 'user', userId }) })
    }
    this.notify({ kind: 'order-updated', orderId: event.resource.id, status: event.data.status })
  }

  /** After a gap in the event stream, REST is the source of truth for anything on screen. */
  private reconcile() {
    const qc = this.queryClient
    if (!qc) return
    void qc.invalidateQueries({ queryKey: queryKeys.nfts.all, refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: queryKeys.private, refetchType: 'active' })
    this.notify({ kind: 'reconnected' })
  }
}

export const realtime = new RealtimeClient()
