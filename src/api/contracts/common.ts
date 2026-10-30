import { z } from 'zod'
import { ETH_PATTERN } from '@/lib/money'

export const ethAmount = z.string().regex(ETH_PATTERN, 'Valor em ETH inválido')
export const isoDate = z.iso.datetime({ offset: true })
export const id = z.string().min(1)

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const networkSchema = z.enum(NETWORKS)
export type Network = z.infer<typeof networkSchema>

export const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase'] as const
export const walletProviderSchema = z.enum(WALLET_PROVIDERS)
export type WalletProvider = z.infer<typeof walletProviderSchema>

export const WALLET_PROVIDER_LABEL: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

/**
 * Every non-2xx response carries this body. `code` is the stable,
 * machine-readable discriminator; `fieldErrors` maps form fields to messages.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'INVALID_CREDENTIALS',
  'INVALID_PASSWORD',
  'AVAILABILITY_CONFLICT',
  'EDITION_UNAVAILABLE',
  'QUANTITY_LIMIT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'QUOTE_CHANGED',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_REJECTED',
  'WALLET_DISCONNECTED',
  'CART_EMPTY',
  'TRANSIENT',
  'INTERNAL',
] as const
export const errorCodeSchema = z.enum(ERROR_CODES)
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
