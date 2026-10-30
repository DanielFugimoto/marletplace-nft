import { z } from 'zod'
import { ethAmount, id, isoDate, networkSchema } from './common'
import { editionKindSchema } from './nft'

export const cartItemSchema = z.object({
  id,
  nftId: id,
  editionId: editionKindSchema,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  quantity: z.number().int().min(1),
  /** Current catalog price for this edition. */
  unitPrice: ethAmount,
  /** Price the collector saw when the item was added or last acknowledged. */
  acknowledgedPrice: ethAmount,
  lineTotal: ethAmount,
  /** Units currently available for this edition. */
  available: z.number().int().min(0),
  /** Upper bound for `quantity`: min(available, maxPerOrder). */
  maxQuantity: z.number().int().min(0),
  nftVersion: z.number().int(),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  id,
  owner: z.enum(['guest', 'user']),
  items: z.array(cartItemSchema),
  couponCode: z.string().nullable(),
  itemCount: z.number().int().min(0),
  updatedAt: isoDate,
  version: z.number().int(),
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemSchema = z.object({
  nftId: id,
  editionId: editionKindSchema,
  quantity: z.number().int().min(1),
})
export type AddCartItemRequest = z.infer<typeof addCartItemSchema>

export const updateCartItemSchema = z.object({ quantity: z.number().int().min(1) })

export const applyCouponSchema = z.object({ code: z.string().trim().min(1, 'Informe o código promocional').max(32) })

export const QUOTE_ISSUES = ['price_changed', 'insufficient_availability', 'sold_out'] as const

export const quoteLineSchema = z.object({
  itemId: id,
  nftId: id,
  editionId: editionKindSchema,
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  editionLabel: z.string(),
  quantity: z.number().int(),
  unitPrice: ethAmount,
  lineTotal: ethAmount,
  issue: z.enum(QUOTE_ISSUES).nullable(),
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const quoteSchema = z.object({
  /** Fingerprint of everything that affects the total; required to place an order. */
  id,
  network: networkSchema,
  lines: z.array(quoteLineSchema),
  subtotal: ethAmount,
  discount: ethAmount,
  networkFee: ethAmount,
  total: ethAmount,
  coupon: z
    .object({
      code: z.string(),
      description: z.string(),
      status: z.enum(['applied', 'invalid', 'expired']),
    })
    .nullable(),
  /** False when any line has an issue that blocks checkout. */
  purchasable: z.boolean(),
  createdAt: isoDate,
  expiresAt: isoDate,
})
export type Quote = z.infer<typeof quoteSchema>

export const quoteParamsSchema = z.object({ network: networkSchema.default('ethereum') })
