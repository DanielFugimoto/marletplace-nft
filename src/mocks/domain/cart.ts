import type { Cart, Network, Quote, QuoteLine } from '@/api/contracts'
import { addEth, compareEth, eth, mulEth, subEth, toEth } from '@/lib/money'
import { db, findEdition, findNft, fingerprint, newId, nowIso, persist } from '../db/store'
import type { CartRecord, UserRecord } from '../db/types'

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

interface CouponDef {
  description: string
  expired?: boolean
  percent?: string
  fixed?: string
}

/** Demo coupons (documented in the README). */
export const COUPONS: Record<string, CouponDef> = {
  KURIO10: { description: '10% de desconto de lançamento', percent: '0.10' },
  GENESIS: { description: '0.05 ETH de desconto na coleção gênesis', fixed: '0.05' },
  VERAO2025: { description: 'Campanha de verão 2025', percent: '0.15', expired: true },
}

export const QUOTE_TTL_MS = 5 * 60_000

export function findCartForRequest(request: Request, user: UserRecord | null): CartRecord | undefined {
  if (user) return db.state.carts.find((c) => c.userId === user.id)
  const guestId = request.headers.get('X-Cart-Id')
  return guestId ? db.state.carts.find((c) => c.id === guestId && c.userId === null) : undefined
}

export function getOrCreateCart(request: Request, user: UserRecord | null): CartRecord {
  const existing = findCartForRequest(request, user)
  if (existing) return existing
  const cart: CartRecord = {
    id: newId(user ? 'cart' : 'guest'),
    userId: user?.id ?? null,
    items: [],
    couponCode: null,
    updatedAt: nowIso(),
    version: 1,
  }
  db.state.carts.push(cart)
  persist()
  return cart
}

export function touchCart(cart: CartRecord) {
  cart.updatedAt = nowIso()
  cart.version += 1
  persist()
}

export function maxQuantityFor(nftId: string, editionId: string) {
  const nft = findNft(nftId)
  const edition = nft && findEdition(nft, editionId)
  return edition ? Math.min(edition.available, edition.maxPerOrder) : 0
}

export function cartView(cart: CartRecord): Cart {
  const items = cart.items.flatMap((item) => {
    const nft = findNft(item.nftId)
    const edition = nft && findEdition(nft, item.editionId)
    if (!nft || !edition) return []
    return [
      {
        id: item.id,
        nftId: nft.id,
        editionId: edition.id,
        editionLabel: edition.label,
        name: nft.name,
        tokenId: nft.tokenId,
        image: nft.image,
        imageAlt: nft.imageAlt,
        quantity: item.quantity,
        unitPrice: edition.price,
        acknowledgedPrice: item.acknowledgedPrice,
        lineTotal: mulEth(edition.price, item.quantity),
        available: edition.available,
        maxQuantity: Math.min(edition.available, edition.maxPerOrder),
        nftVersion: nft.version,
      },
    ]
  })
  return {
    id: cart.id,
    owner: cart.userId ? 'user' : 'guest',
    items,
    couponCode: cart.couponCode,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    updatedAt: cart.updatedAt,
    version: cart.version,
  }
}

export function couponDiscount(code: string | null, subtotal: string) {
  const coupon = code ? COUPONS[code] : undefined
  if (!coupon || coupon.expired) return '0'
  const raw = coupon.percent ? eth(subtotal).times(coupon.percent) : eth(coupon.fixed ?? '0')
  // Discount never exceeds the subtotal; rounded down to 6 decimals.
  const capped = raw.gt(subtotal) ? eth(subtotal) : raw
  return toEth(capped.round(6, 0))
}

export function computeQuote(cart: CartRecord, network: Network): Quote {
  const lines: QuoteLine[] = cart.items.flatMap((item) => {
    const nft = findNft(item.nftId)
    const edition = nft && findEdition(nft, item.editionId)
    if (!nft || !edition) return []
    const issue =
      edition.available === 0
        ? 'sold_out'
        : item.quantity > edition.available
          ? 'insufficient_availability'
          : compareEth(edition.price, item.acknowledgedPrice) !== 0
            ? 'price_changed'
            : null
    return [
      {
        itemId: item.id,
        nftId: nft.id,
        editionId: edition.id,
        name: nft.name,
        tokenId: nft.tokenId,
        image: nft.image,
        imageAlt: nft.imageAlt,
        editionLabel: edition.label,
        quantity: item.quantity,
        unitPrice: edition.price,
        lineTotal: mulEth(edition.price, item.quantity),
        issue,
      },
    ]
  })
  const subtotal = addEth('0', ...lines.map((l) => l.lineTotal))
  const coupon = cart.couponCode ? COUPONS[cart.couponCode] : undefined
  const discount = couponDiscount(cart.couponCode, subtotal)
  const networkFee = lines.length > 0 ? NETWORK_FEES[network] : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)
  const priced = {
    network,
    lines: lines.map(({ nftId, editionId, quantity, unitPrice }) => [nftId, editionId, quantity, unitPrice]),
    coupon: cart.couponCode,
    discount,
    networkFee,
    total,
  }
  const createdAt = nowIso()
  return {
    id: `q-${fingerprint(priced)}`,
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon: cart.couponCode
      ? {
          code: cart.couponCode,
          description: coupon?.description ?? 'Cupom inválido',
          status: !coupon ? 'invalid' : coupon.expired ? 'expired' : 'applied',
        }
      : null,
    // Any issue blocks checkout: price changes need an explicit acknowledgement
    // (POST /cart/acknowledge) and availability issues need a quantity change.
    purchasable: lines.length > 0 && lines.every((l) => l.issue === null),
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + QUOTE_TTL_MS).toISOString(),
  }
}

/** Moves guest items into the user's cart, capping each line at what can be bought. */
export function mergeGuestCart(guestCartId: string | null, userId: string): boolean {
  if (!guestCartId) return false
  const guest = db.state.carts.find((c) => c.id === guestCartId && c.userId === null)
  if (!guest) return false
  let userCart = db.state.carts.find((c) => c.userId === userId)
  if (!userCart) {
    userCart = { id: newId('cart'), userId, items: [], couponCode: null, updatedAt: nowIso(), version: 1 }
    db.state.carts.push(userCart)
  }
  for (const item of guest.items) {
    const max = maxQuantityFor(item.nftId, item.editionId)
    const existing = userCart.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
    if (existing) existing.quantity = Math.min(existing.quantity + item.quantity, Math.max(max, existing.quantity))
    else if (max > 0) userCart.items.push({ ...item, quantity: Math.min(item.quantity, max) })
  }
  userCart.couponCode ??= guest.couponCode
  db.state.carts = db.state.carts.filter((c) => c.id !== guest.id)
  touchCart(userCart)
  return guest.items.length > 0
}
