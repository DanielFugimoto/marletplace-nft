import { z } from 'zod'
import { emailSchema, usernameSchema } from './auth'
import { ethAmount, id, isoDate, networkSchema, walletProviderSchema } from './common'
import { ensNameSchema, walletAddressSchema } from './account'
import { quoteLineSchema } from './cart'

export const ORDER_STATUSES = ['pending', 'confirmed', 'rejected'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const isTerminalStatus = (s: OrderStatus) => s !== 'pending'

export const buyerSchema = z.object({
  displayName: z.string().trim().min(1, 'Informe o nome de exibição').max(60),
  username: usernameSchema,
  profileName: z.string().trim().min(1, 'Informe o nome do perfil').max(60),
  email: emailSchema,
  ensName: ensNameSchema.min(1, 'Informe o nome ENS'),
  referralCode: z.string().trim().min(1, 'Informe o código de indicação'),
  walletAddress: walletAddressSchema,
  secondaryAddress: z.string().trim(),
  walletType: walletProviderSchema,
  note: z.string().trim().max(500, 'Use no máximo 500 caracteres'),
})
export type Buyer = z.infer<typeof buyerSchema>

export const createOrderSchema = z.object({
  quoteId: id,
  network: networkSchema,
  walletId: id,
  connectionId: id,
  buyer: buyerSchema,
})
export type CreateOrderRequest = z.infer<typeof createOrderSchema>

export const orderSchema = z.object({
  id,
  status: orderStatusSchema,
  /** Snapshot of the quote at creation time; never recomputed. */
  lines: z.array(quoteLineSchema),
  subtotal: ethAmount,
  discount: ethAmount,
  networkFee: ethAmount,
  total: ethAmount,
  couponCode: z.string().nullable(),
  network: networkSchema,
  wallet: z.object({ id, provider: walletProviderSchema, address: z.string(), label: z.string() }),
  buyer: buyerSchema,
  transaction: z
    .object({ hash: z.string(), explorerUrl: z.string() })
    .nullable(),
  failureReason: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int().min(1),
})
export type Order = z.infer<typeof orderSchema>
