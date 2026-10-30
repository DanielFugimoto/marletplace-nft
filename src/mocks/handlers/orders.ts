import { delay, http, HttpResponse } from 'msw'
import { createOrderSchema } from '@/api/contracts'
import { mulEth } from '@/lib/money'
import { ORDER_TIMEOUT_MS } from '@/api/client'
import { db, findEdition, findNft, fingerprint, newId, nowIso, persist } from '../db/store'
import type { OrderRecord } from '../db/types'
import { computeQuote } from '../domain/cart'
import { resolveIfDue, scheduleResolution, toOrder } from '../domain/orders'
import { publishNftUpdated } from '../realtime'
import { mockConfig, saveConfig } from '../scenarios'
import { api, handle, parseBody, raise, requireUser } from '../utils'

/** Applies the one-shot "something changed during checkout" scenarios. */
function applyCheckoutSurprises(nftId: string, editionId: string) {
  const config = mockConfig.current
  const { priceChangeOnCheckout, soldOutOnCheckout } = config.flags
  if (!priceChangeOnCheckout && !soldOutOnCheckout) return
  const nft = findNft(nftId)
  const edition = nft && findEdition(nft, editionId)
  if (!nft || !edition) return
  if (priceChangeOnCheckout) {
    edition.price = mulEth(edition.price, '1.1')
    config.flags.priceChangeOnCheckout = false
  }
  if (soldOutOnCheckout) {
    edition.available = 0
    config.flags.soldOutOnCheckout = false
  }
  nft.version += 1
  saveConfig(config)
  persist()
  publishNftUpdated(nft)
}

function ownedOrder(request: Request, id: string) {
  const user = requireUser(request)
  const order = db.state.orders.find((o) => o.id === id)
  // Other users' orders are reported as missing, never as forbidden, to avoid leaking ids.
  if (!order || order.userId !== user.id) return raise('NOT_FOUND', 'Pedido não encontrado.')
  return order
}

export const orderHandlers = [
  http.post(
    api('/orders'),
    handle(async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get('Idempotency-Key')
      if (!key || key.length < 8) raise('VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido.')
      const body = await parseBody(request, createOrderSchema)
      const requestHash = fingerprint(body)

      const previous = db.state.orders.find((o) => o.userId === user.id && o.idempotencyKey === key)
      if (previous) {
        if (previous.requestHash !== requestHash) {
          raise('IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        resolveIfDue(previous)
        return HttpResponse.json(toOrder(previous), { status: 200 })
      }

      const cart = db.state.carts.find((c) => c.userId === user.id)
      if (!cart || cart.items.length === 0) raise('CART_EMPTY', 'Seu carrinho está vazio.')

      const connection = db.state.connections.find((c) => c.id === body.connectionId && c.userId === user.id)
      if (!connection?.active || connection.walletId !== body.walletId || connection.network !== body.network) {
        raise('WALLET_DISCONNECTED', 'A carteira foi desconectada. Conecte-a novamente para continuar.')
      }
      const wallet = db.state.wallets.find((w) => w.id === body.walletId && w.userId === user.id)
      if (!wallet) raise('NOT_FOUND', 'Carteira não encontrada.')

      const first = cart!.items[0]!
      applyCheckoutSurprises(first.nftId, first.editionId)

      const quote = computeQuote(cart!, body.network)
      if (quote.id !== body.quoteId || quote.lines.some((l) => l.issue === 'price_changed')) {
        raise('QUOTE_CHANGED', 'Os valores do pedido mudaram. Revise e confirme novamente.', { details: { quote } })
      }
      if (!quote.purchasable) {
        raise('AVAILABILITY_CONFLICT', 'Algumas edições não têm mais a quantidade solicitada.', { details: { quote } })
      }

      const now = nowIso()
      const order: OrderRecord = {
        id: newId('ord'),
        status: 'pending',
        lines: quote.lines,
        subtotal: quote.subtotal,
        discount: quote.discount,
        networkFee: quote.networkFee,
        total: quote.total,
        couponCode: quote.coupon?.status === 'applied' ? quote.coupon.code : null,
        network: body.network,
        wallet: { id: wallet!.id, provider: wallet!.provider, address: wallet!.address, label: wallet!.nickname },
        buyer: body.buyer,
        transaction: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
        userId: user.id,
        idempotencyKey: key!,
        requestHash,
        resolveAt: new Date(Date.now() + mockConfig.current.flags.orderResolveMs).toISOString(),
        outcome: mockConfig.current.flags.orderOutcome,
      }
      db.state.orders.push(order)
      persist()
      scheduleResolution(order)

      if (mockConfig.current.flags.orderTimeoutOnce) {
        // The order exists server-side but the client gives up waiting; a retry
        // with the same key must return this very order.
        mockConfig.current.flags.orderTimeoutOnce = false
        saveConfig(mockConfig.current)
        await delay(ORDER_TIMEOUT_MS + 4_000)
      }
      return HttpResponse.json(toOrder(order), { status: 201 })
    }),
  ),

  http.get(
    api('/orders'),
    handle(({ request }) => {
      const user = requireUser(request)
      const orders = db.state.orders.filter((o) => o.userId === user.id)
      orders.forEach(resolveIfDue)
      return HttpResponse.json(orders.map(toOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    }),
  ),

  http.get(
    api('/orders/:id'),
    handle(({ request, params }) => {
      const order = ownedOrder(request, String(params.id))
      resolveIfDue(order)
      return HttpResponse.json(toOrder(order))
    }),
  ),
]
