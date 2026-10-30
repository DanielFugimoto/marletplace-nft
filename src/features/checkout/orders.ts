import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/api/client'
import { type CreateOrderRequest, isTerminalStatus, type Order } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { useSession } from '@/features/auth/session'
import { randomUuid } from '@/lib/crypto'
import { STORAGE_KEYS, storage } from '@/lib/storage'

/**
 * A checkout attempt pins one idempotency key to one exact request body.
 * Repeated clicks, automatic retries after a timeout and retries after a
 * reload all reuse it, so the backend can never create a second order.
 */
interface CheckoutAttempt {
  userId: string
  key: string
  body: CreateOrderRequest
}

interface PendingOrderMarker {
  userId: string
  orderId: string
}

const sameBody = (a: CreateOrderRequest, b: CreateOrderRequest) => JSON.stringify(a) === JSON.stringify(b)

export const checkoutAttempt = {
  get(userId: string) {
    const attempt = storage.get<CheckoutAttempt>(STORAGE_KEYS.checkoutAttempt)
    return attempt?.userId === userId ? attempt : null
  },
  /** Reuses the stored attempt when the body is identical, otherwise starts a new one. */
  begin(userId: string, body: CreateOrderRequest): CheckoutAttempt {
    const existing = this.get(userId)
    if (existing && sameBody(existing.body, body)) return existing
    const attempt = { userId, key: `ck-${randomUuid()}`, body }
    storage.set(STORAGE_KEYS.checkoutAttempt, attempt)
    return attempt
  },
  clear() {
    storage.remove(STORAGE_KEYS.checkoutAttempt)
  },
}

export const pendingOrderMarker = {
  get(userId: string) {
    const marker = storage.get<PendingOrderMarker>(STORAGE_KEYS.pendingOrder)
    return marker?.userId === userId ? marker.orderId : null
  },
  set(userId: string, orderId: string) {
    storage.set(STORAGE_KEYS.pendingOrder, { userId, orderId })
  },
  clear() {
    storage.remove(STORAGE_KEYS.pendingOrder)
  },
}

const AUTO_RETRIES_ON_TIMEOUT = 2

export function useCreateOrder() {
  const queryClient = useQueryClient()
  const { user } = useSession()

  return useMutation({
    mutationKey: ['orders', 'create'],
    mutationFn: async (body: CreateOrderRequest) => {
      if (!user) throw new Error('not authenticated')
      const attempt = checkoutAttempt.begin(user.id, body)
      for (let i = 0; ; i++) {
        try {
          return await orderApi.create(attempt.body, attempt.key)
        } catch (error) {
          // Same key + same body is safe to resend: the server returns the
          // order it already created instead of a new one.
          if (isApiError(error) && error.isTransient && i < AUTO_RETRIES_ON_TIMEOUT) continue
          throw error
        }
      }
    },
    onSuccess: (order) => {
      if (!user) return
      checkoutAttempt.clear()
      pendingOrderMarker.set(user.id, order.id)
      queryClient.setQueryData(queryKeys.order(user.id, order.id), order)
    },
  })
}

export function useOrder(orderId: string) {
  const { user } = useSession()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.order(user?.id ?? 'anonymous', orderId),
    queryFn: async ({ signal }) => {
      const order = await orderApi.get(orderId, { signal })
      if (user && isTerminalStatus(order.status)) {
        if (pendingOrderMarker.get(user.id) === order.id) pendingOrderMarker.clear()
        // A confirmed order removed items from the server-side cart.
        void queryClient.invalidateQueries({ queryKey: queryKeys.cartRoot({ kind: 'user', userId: user.id }) })
      }
      return order
    },
    enabled: Boolean(user),
    // Realtime events are the primary signal; polling is the fallback while pending.
    refetchInterval: (query) => (query.state.data && !isTerminalStatus(query.state.data.status) ? 4_000 : false),
  })
}

/** Most recent pending order of the current user, recovered after refresh or reconnection. */
export function usePendingOrder() {
  const { user } = useSession()
  const orderId = user ? pendingOrderMarker.get(user.id) : null
  const query = useQuery({
    queryKey: queryKeys.order(user?.id ?? 'anonymous', orderId ?? 'none'),
    queryFn: ({ signal }) => orderApi.get(orderId!, { signal }),
    enabled: Boolean(user && orderId),
  })
  const order: Order | undefined = query.data
  return order && !isTerminalStatus(order.status) ? order : null
}
