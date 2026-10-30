import { http, HttpResponse } from 'msw'
import { addCartItemSchema, applyCouponSchema, quoteParamsSchema, updateCartItemSchema } from '@/api/contracts'
import { findEdition, findNft, newId, persist } from '../db/store'
import type { CartRecord } from '../db/types'
import { cartView, computeQuote, COUPONS, getOrCreateCart, maxQuantityFor, touchCart } from '../domain/cart'
import { api, handle, optionalUser, parseBody, raise } from '../utils'

function respond(cart: CartRecord, status = 200) {
  return HttpResponse.json(cartView(cart), { status })
}

function findItem(cart: CartRecord, itemId: string) {
  return cart.items.find((i) => i.id === itemId) ?? raise('NOT_FOUND', 'Item não está no carrinho.')
}

function assertQuantity(nftId: string, editionId: string, quantity: number) {
  const max = maxQuantityFor(nftId, editionId)
  if (max === 0) raise('EDITION_UNAVAILABLE', 'Esta edição está esgotada.', { details: { max } })
  if (quantity > max) {
    raise('QUANTITY_LIMIT', `Quantidade máxima disponível para esta edição: ${max}.`, {
      fieldErrors: { quantity: `Máximo de ${max}` },
      details: { max },
    })
  }
}

export const cartHandlers = [
  http.get(
    api('/cart'),
    handle(({ request }) => respond(getOrCreateCart(request, optionalUser(request)))),
  ),

  http.post(
    api('/cart/items'),
    handle(async ({ request }) => {
      const user = optionalUser(request)
      const body = await parseBody(request, addCartItemSchema)
      const nft = findNft(body.nftId) ?? raise('NOT_FOUND', 'NFT não encontrado.')
      const edition = findEdition(nft, body.editionId) ?? raise('NOT_FOUND', 'Edição não encontrada.')
      const cart = getOrCreateCart(request, user)
      const existing = cart.items.find((i) => i.nftId === nft.id && i.editionId === edition.id)
      const nextQuantity = (existing?.quantity ?? 0) + body.quantity
      assertQuantity(nft.id, edition.id, nextQuantity)
      if (existing) {
        existing.quantity = nextQuantity
        existing.acknowledgedPrice = edition.price
      } else {
        cart.items.push({
          id: newId('item'),
          nftId: nft.id,
          editionId: edition.id,
          quantity: body.quantity,
          acknowledgedPrice: edition.price,
        })
      }
      touchCart(cart)
      return respond(cart, 201)
    }),
  ),

  http.patch(
    api('/cart/items/:itemId'),
    handle(async ({ request, params }) => {
      const cart = getOrCreateCart(request, optionalUser(request))
      const item = findItem(cart, String(params.itemId))
      const { quantity } = await parseBody(request, updateCartItemSchema)
      // Lowering quantity is always allowed, even if availability dropped meanwhile.
      if (quantity > item.quantity) assertQuantity(item.nftId, item.editionId, quantity)
      item.quantity = quantity
      touchCart(cart)
      return respond(cart)
    }),
  ),

  http.delete(
    api('/cart/items/:itemId'),
    handle(({ request, params }) => {
      const cart = getOrCreateCart(request, optionalUser(request))
      const item = findItem(cart, String(params.itemId))
      cart.items = cart.items.filter((i) => i.id !== item.id)
      touchCart(cart)
      return respond(cart)
    }),
  ),

  http.post(
    api('/cart/acknowledge'),
    handle(({ request }) => {
      const cart = getOrCreateCart(request, optionalUser(request))
      for (const item of cart.items) {
        const nft = findNft(item.nftId)
        const edition = nft && findEdition(nft, item.editionId)
        if (edition) {
          item.acknowledgedPrice = edition.price
          // Clamp to what is still available so the cart becomes purchasable again.
          const max = Math.min(edition.available, edition.maxPerOrder)
          if (max > 0 && item.quantity > max) item.quantity = max
        }
      }
      touchCart(cart)
      return respond(cart)
    }),
  ),

  http.put(
    api('/cart/coupon'),
    handle(async ({ request }) => {
      const cart = getOrCreateCart(request, optionalUser(request))
      const { code } = await parseBody(request, applyCouponSchema)
      const normalized = code.toUpperCase()
      const coupon = COUPONS[normalized]
      if (!coupon) raise('COUPON_INVALID', 'Código promocional inválido.', { fieldErrors: { code: 'Código inválido' } })
      if (coupon!.expired)
        raise('COUPON_EXPIRED', 'Este código promocional expirou.', { fieldErrors: { code: 'Código expirado' } })
      cart.couponCode = normalized
      touchCart(cart)
      return respond(cart)
    }),
  ),

  http.delete(
    api('/cart/coupon'),
    handle(({ request }) => {
      const cart = getOrCreateCart(request, optionalUser(request))
      cart.couponCode = null
      touchCart(cart)
      return respond(cart)
    }),
  ),

  http.get(
    api('/cart/quote'),
    handle(({ request }) => {
      const cart = getOrCreateCart(request, optionalUser(request))
      const parsed = quoteParamsSchema.safeParse({ network: new URL(request.url).searchParams.get('network') ?? undefined })
      if (!parsed.success) raise('VALIDATION_ERROR', 'Rede inválida.')
      persist()
      return HttpResponse.json(computeQuote(cart, parsed.data!.network))
    }),
  ),
]
