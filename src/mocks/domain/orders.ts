import type { Network, Order } from '@/api/contracts'
import { db, findEdition, findNft, fingerprint, nowIso, persist } from '../db/store'
import type { OrderRecord } from '../db/types'
import { publishNftUpdated, publishOrderUpdated } from '../realtime'
import { touchCart } from './cart'

const EXPLORERS: Record<Network, string> = {
  ethereum: 'https://sepolia.etherscan.io/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
  solana: 'https://explorer.solana.com/tx/',
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function toOrder(record: OrderRecord): Order {
  const { userId: _u, idempotencyKey: _k, requestHash: _h, resolveAt: _r, outcome: _o, ...order } = record
  return order
}

function reject(order: OrderRecord, reason: string) {
  order.status = 'rejected'
  order.failureReason = reason
}

function confirm(order: OrderRecord) {
  const lines = order.lines.map((line) => {
    const nft = findNft(line.nftId)
    return { line, nft, edition: nft && findEdition(nft, line.editionId) }
  })
  if (lines.some(({ edition, line }) => !edition || edition.available < line.quantity)) {
    reject(order, 'Uma das edições esgotou antes da confirmação na rede. Nenhum valor foi cobrado.')
    return
  }
  const touched = new Set<string>()
  for (const { line, nft, edition } of lines) {
    edition!.available -= line.quantity
    if (!touched.has(nft!.id)) {
      nft!.version += 1
      touched.add(nft!.id)
    }
  }
  // Only the purchased quantities leave the cart; anything added meanwhile stays.
  const cart = db.state.carts.find((c) => c.userId === order.userId)
  if (cart) {
    for (const line of order.lines) {
      const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
      if (item) item.quantity -= line.quantity
    }
    cart.items = cart.items.filter((i) => i.quantity > 0)
    if (cart.items.length === 0) cart.couponCode = null
    touchCart(cart)
  }
  const hash = `0x${fingerprint(order.id)}${fingerprint(order.total)}${fingerprint(order.createdAt)}${fingerprint(order.userId)}`
  order.status = 'confirmed'
  order.transaction = { hash, explorerUrl: `${EXPLORERS[order.network]}${hash}` }
  for (const id of touched) publishNftUpdated(findNft(id)!)
}

/** Settles a pending order once its simulated block time has passed. */
export function resolveIfDue(order: OrderRecord) {
  if (order.status !== 'pending' || Date.parse(order.resolveAt) > Date.now()) return false
  timers.delete(order.id)
  if (order.outcome === 'reject') reject(order, 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado.')
  else confirm(order)
  order.version += 1
  order.updatedAt = nowIso()
  persist()
  publishOrderUpdated(order)
  return true
}

export function scheduleResolution(order: OrderRecord) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, Date.parse(order.resolveAt) - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      resolveIfDue(order)
    }, wait),
  )
}

/** Called on startup so pending orders keep settling after a page refresh. */
export function resumePendingOrders() {
  for (const order of db.state.orders) {
    if (!resolveIfDue(order)) scheduleResolution(order)
  }
}

export function clearOrderTimers() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

