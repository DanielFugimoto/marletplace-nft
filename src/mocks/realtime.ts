import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandlerConnection } from 'msw'
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { env } from '@/env'
import { db, isSoldOut, nextEventId, nowIso, toSummary } from './db/store'
import type { NftRecord, OrderRecord } from './db/types'

/**
 * Socket.IO server simulated through MSW's WebSocket interception plus
 * @mswjs/socket.io-binding. Limitations (documented in ARCHITECTURE.md):
 * - websocket transport only (no HTTP long-polling);
 * - default namespace only, no rooms/acks;
 * - the binding ignores the CONNECT auth payload, so we parse it ourselves;
 * - the binding sends no engine.io pings, so we send them to keep the client alive.
 */

const PING_INTERVAL_MS = 25_000
const EVENT_LOG_SIZE = 50

interface Client {
  connection: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  userId: string | null
  ping: ReturnType<typeof setInterval>
}

const clients = new Set<Client>()
const eventLog: RealtimeEvent[] = []
let refuseUntil = 0

function socketUrlPattern() {
  const origin = new URL(env.socketUrl, window.location.origin)
  const wsOrigin = origin.origin.replace(/^http/, 'ws')
  // MSW strips the "/socket.io/" prefix from client URLs before matching,
  // so the link targets the origin itself.
  return wsOrigin
}

function userIdForToken(token: unknown) {
  if (typeof token !== 'string') return null
  const session = db.state.sessions.find((s) => s.token === token && Date.parse(s.expiresAt) > Date.now())
  return session?.userId ?? null
}

export const realtimeLink = ws.link(socketUrlPattern())

export const realtimeHandler = realtimeLink.addEventListener('connection', (connection) => {
  if (Date.now() < refuseUntil) {
    // Simulated outage: let the handshake go to the real origin, which has no
    // Socket.IO server, so the client gets a genuine connection error and retries
    // with backoff exactly as it would against an unreachable server.
    connection.server.connect()
    return
  }
  const io = toSocketIo(connection)
  const client: Client = {
    connection,
    io,
    userId: null,
    ping: setInterval(() => connection.client.send('2'), PING_INTERVAL_MS),
  }
  clients.add(client)

  connection.client.addEventListener('message', (event) => {
    // Socket.IO CONNECT packet for the default namespace: "40" + JSON(auth).
    if (typeof event.data === 'string' && event.data.startsWith('40')) {
      try {
        const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: unknown }
        client.userId = userIdForToken(auth.token)
      } catch {
        client.userId = null
      }
    }
  })
  connection.client.addEventListener('close', () => {
    clearInterval(client.ping)
    clients.delete(client)
  })
})

function remember(event: RealtimeEvent) {
  eventLog.push(event)
  if (eventLog.length > EVENT_LOG_SIZE) eventLog.shift()
}

function deliver(event: RealtimeEvent) {
  for (const client of clients) {
    // Order events are private: only sockets authenticated as the owner receive them.
    if (event.type === 'order.updated' && client.userId !== event.data.userId) continue
    client.io.client.emit(event.type, event)
  }
}

export function nftUpdatedEvent(nft: NftRecord): NftUpdatedEvent {
  const summary = toSummary(nft)
  return {
    id: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: nowIso(),
    data: {
      price: summary.price,
      compareAtPrice: summary.compareAtPrice,
      soldOut: isSoldOut(nft),
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  }
}

export function publishNftUpdated(nft: NftRecord) {
  const event = nftUpdatedEvent(nft)
  remember(event)
  deliver(event)
  return event
}

export function publishOrderUpdated(order: OrderRecord) {
  const event: OrderUpdatedEvent = {
    id: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: nowIso(),
    data: {
      userId: order.userId,
      status: order.status,
      transactionHash: order.transaction?.hash ?? null,
      failureReason: order.failureReason,
    },
  }
  remember(event)
  deliver(event)
  return event
}

/** Re-sends an already delivered event verbatim (duplicate delivery). */
export function replayEvent(eventId?: string) {
  const event = eventId ? eventLog.find((e) => e.id === eventId) : eventLog.at(-1)
  if (event) deliver(event)
  return event ?? null
}

/** Sends a raw event as-is, e.g. one with an outdated version. */
export function deliverRaw(event: RealtimeEvent) {
  deliver(event)
}

/** Drops every socket and refuses reconnections for `ms`, simulating an outage. */
export function dropConnections(ms: number) {
  refuseUntil = Date.now() + ms
  for (const client of [...clients]) client.connection.client.close(4000, 'simulated outage')
}

export function disconnectUser(userId: string) {
  for (const client of [...clients]) if (client.userId === userId) client.connection.client.close(1000)
}

export const realtimeStats = () => ({
  clients: [...clients].map((c) => ({ userId: c.userId })),
  lastEvents: eventLog.slice(-10),
})
