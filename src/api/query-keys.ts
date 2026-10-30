import type { Network, NftListParams } from './contracts'

/**
 * Cache key conventions:
 * - public data lives under ['public', ...] and is shared by everyone;
 * - private data lives under ['private', <scope>, ...] where scope is the user
 *   id (or the guest cart id for the visitor cart). Logout or a user switch
 *   removes the whole ['private'] subtree, so no data leaks between sessions.
 */
export type CartScope = { kind: 'user'; userId: string } | { kind: 'guest'; cartId: string | null }

const scopeKey = (scope: CartScope) => (scope.kind === 'user' ? scope.userId : `guest:${scope.cartId ?? 'new'}`)

export const queryKeys = {
  session: (token: string | null) => ['session', token] as const,

  nfts: {
    all: ['public', 'nfts'] as const,
    lists: () => ['public', 'nfts', 'list'] as const,
    list: (params: NftListParams) => ['public', 'nfts', 'list', params] as const,
    details: () => ['public', 'nfts', 'detail'] as const,
    detail: (id: string) => ['public', 'nfts', 'detail', id] as const,
  },

  private: ['private'] as const,
  user: (userId: string) => ['private', userId] as const,
  favorites: (userId: string) => ['private', userId, 'favorites'] as const,
  profile: (userId: string) => ['private', userId, 'profile'] as const,
  wallets: (userId: string) => ['private', userId, 'wallets'] as const,
  orders: (userId: string) => ['private', userId, 'orders'] as const,
  order: (userId: string, orderId: string) => ['private', userId, 'orders', orderId] as const,
  connection: (userId: string, connectionId: string) => ['private', userId, 'wallet-connection', connectionId] as const,

  cartRoot: (scope: CartScope) => ['private', scopeKey(scope), 'cart'] as const,
  cart: (scope: CartScope) => ['private', scopeKey(scope), 'cart', 'items'] as const,
  quote: (scope: CartScope, network: Network) => ['private', scopeKey(scope), 'cart', 'quote', network] as const,
}
