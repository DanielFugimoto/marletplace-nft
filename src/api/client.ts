import { z } from 'zod'
import {
  type AddCartItemRequest,
  cartSchema,
  type ChangePasswordRequest,
  type CreateOrderRequest,
  type CreateWalletRequest,
  favoritesSchema,
  loginResponseSchema,
  type LoginRequest,
  type Network,
  nftDetailSchema,
  type NftListParams,
  nftListResponseSchema,
  orderSchema,
  profileSchema,
  quoteSchema,
  type RegisterRequest,
  sessionSchema,
  type UpdateProfileRequest,
  walletConnectionSchema,
  type WalletInput,
  walletSchema,
} from './contracts'
import { request, send } from './http'

type Opts = { signal?: AbortSignal }

/** Arrays are sent comma-separated; empty values are omitted. */
export function serializeListParams(params: NftListParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue
    out[key] = Array.isArray(value) ? value.join(',') : String(value)
  }
  return out
}

export const authApi = {
  register: (body: RegisterRequest) =>
    request(loginResponseSchema, { method: 'POST', url: '/auth/register', data: body }),
  login: (body: LoginRequest) => request(loginResponseSchema, { method: 'POST', url: '/auth/login', data: body }),
  session: (opts?: Opts) =>
    request(sessionSchema, { method: 'GET', url: '/auth/session', signal: opts?.signal, skipAuthRedirect: true }),
  logout: () => send({ method: 'POST', url: '/auth/logout', skipAuthRedirect: true }),
}

export const nftApi = {
  list: (params: NftListParams, opts?: Opts) =>
    request(nftListResponseSchema, { method: 'GET', url: '/nfts', params: serializeListParams(params), signal: opts?.signal }),
  detail: (id: string, opts?: Opts) =>
    request(nftDetailSchema, { method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal: opts?.signal }),
}

export const favoritesApi = {
  list: (opts?: Opts) => request(favoritesSchema, { method: 'GET', url: '/me/favorites', signal: opts?.signal }),
  add: (nftId: string) => request(favoritesSchema, { method: 'PUT', url: `/me/favorites/${encodeURIComponent(nftId)}` }),
  remove: (nftId: string) =>
    request(favoritesSchema, { method: 'DELETE', url: `/me/favorites/${encodeURIComponent(nftId)}` }),
}

export const cartApi = {
  get: (opts?: Opts) => request(cartSchema, { method: 'GET', url: '/cart', signal: opts?.signal }),
  addItem: (body: AddCartItemRequest) => request(cartSchema, { method: 'POST', url: '/cart/items', data: body }),
  updateItem: (itemId: string, quantity: number) =>
    request(cartSchema, { method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
  removeItem: (itemId: string) => request(cartSchema, { method: 'DELETE', url: `/cart/items/${itemId}` }),
  /** Marks current prices as seen by the collector (clears price-change notices). */
  acknowledge: () => request(cartSchema, { method: 'POST', url: '/cart/acknowledge' }),
  applyCoupon: (code: string) => request(cartSchema, { method: 'PUT', url: '/cart/coupon', data: { code } }),
  removeCoupon: () => request(cartSchema, { method: 'DELETE', url: '/cart/coupon' }),
  quote: (network: Network, opts?: Opts) =>
    request(quoteSchema, { method: 'GET', url: '/cart/quote', params: { network }, signal: opts?.signal }),
}

export const ORDER_TIMEOUT_MS = 8_000

export const orderApi = {
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    request(orderSchema, {
      method: 'POST',
      url: '/orders',
      data: body,
      headers: { 'Idempotency-Key': idempotencyKey },
      timeoutMs: ORDER_TIMEOUT_MS,
    }),
  get: (id: string, opts?: Opts) =>
    request(orderSchema, { method: 'GET', url: `/orders/${encodeURIComponent(id)}`, signal: opts?.signal }),
  list: (opts?: Opts) => request(z.array(orderSchema), { method: 'GET', url: '/orders', signal: opts?.signal }),
}

export const profileApi = {
  get: (opts?: Opts) => request(profileSchema, { method: 'GET', url: '/me/profile', signal: opts?.signal }),
  update: (body: UpdateProfileRequest) => request(profileSchema, { method: 'PATCH', url: '/me/profile', data: body }),
  updateAvatar: (dataUrl: string) => request(profileSchema, { method: 'PUT', url: '/me/avatar', data: { dataUrl } }),
  removeAvatar: () => request(profileSchema, { method: 'DELETE', url: '/me/avatar' }),
  changePassword: (body: ChangePasswordRequest) => send({ method: 'POST', url: '/me/password', data: body }),
}

export const walletApi = {
  list: (opts?: Opts) => request(z.array(walletSchema), { method: 'GET', url: '/me/wallets', signal: opts?.signal }),
  create: (body: CreateWalletRequest) => request(walletSchema, { method: 'POST', url: '/me/wallets', data: body }),
  update: (id: string, body: WalletInput) =>
    request(walletSchema, { method: 'PUT', url: `/me/wallets/${encodeURIComponent(id)}`, data: body }),
  connect: (walletId: string, network: Network) =>
    request(walletConnectionSchema, { method: 'POST', url: '/wallet-connections', data: { walletId, network } }),
  disconnect: (connectionId: string) =>
    send({ method: 'DELETE', url: `/wallet-connections/${encodeURIComponent(connectionId)}` }),
  getConnection: (connectionId: string, opts?: Opts) =>
    request(walletConnectionSchema, {
      method: 'GET',
      url: `/wallet-connections/${encodeURIComponent(connectionId)}`,
      signal: opts?.signal,
    }),
}
