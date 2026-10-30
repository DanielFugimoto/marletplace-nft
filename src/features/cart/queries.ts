import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { cartApi } from '@/api/client'
import type { AddCartItemRequest, Cart, Network } from '@/api/contracts'
import { credentials } from '@/api/credentials'
import { type CartScope, queryKeys } from '@/api/query-keys'

function currentScope(): CartScope {
  const session = credentials.getSession()
  return session ? { kind: 'user', userId: session.userId } : { kind: 'guest', cartId: credentials.getGuestCartId() }
}

let cachedScope = currentScope()
let cachedScopeKey = JSON.stringify(cachedScope)
function getScope() {
  const next = currentScope()
  const nextKey = JSON.stringify(next)
  if (nextKey !== cachedScopeKey) {
    cachedScope = next
    cachedScopeKey = nextKey
  }
  return cachedScope
}

/** Whose cart we are looking at: the signed-in user's, or the visitor's. */
export function useCartScope(): CartScope {
  return useSyncExternalStore(credentials.subscribe, getScope, getScope)
}

/** Adopts the guest cart id the server assigned, carrying the cached data over. */
function adoptCart(queryClient: QueryClient, cart: Cart) {
  if (cart.owner !== 'guest' || credentials.getSession()) return
  if (credentials.getGuestCartId() !== cart.id) {
    queryClient.setQueryData(queryKeys.cart({ kind: 'guest', cartId: cart.id }), cart)
    credentials.setGuestCartId(cart.id)
  }
}

export function useCart() {
  const scope = useCartScope()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.cart(scope),
    queryFn: async ({ signal }) => {
      const cart = await cartApi.get({ signal })
      adoptCart(queryClient, cart)
      return cart
    },
    staleTime: 15_000,
  })
}

export function useQuote(network: Network, options: { enabled?: boolean } = {}) {
  const scope = useCartScope()
  return useQuery({
    queryKey: queryKeys.quote(scope, network),
    queryFn: ({ signal }) => cartApi.quote(network, { signal }),
    enabled: options.enabled ?? true,
    staleTime: 0,
  })
}

/** Every cart mutation answers with the full cart: store it and refresh quotes. */
function useCartMutation<V>(mutationFn: (vars: V) => Promise<Cart>) {
  const queryClient = useQueryClient()
  const scope = useCartScope()
  return useMutation({
    mutationFn,
    onSuccess: (cart) => {
      adoptCart(queryClient, cart)
      queryClient.setQueryData(queryKeys.cart(currentScope()), cart)
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.cartRoot(currentScope()), 'quote'] })
    },
    onError: () => {
      // Availability may have changed under us; resync.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cartRoot(scope) })
    },
  })
}

export const useAddToCart = () => useCartMutation((body: AddCartItemRequest) => cartApi.addItem(body))
export const useUpdateCartItem = () =>
  useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.updateItem(itemId, quantity))
export const useRemoveCartItem = () => useCartMutation((itemId: string) => cartApi.removeItem(itemId))
export const useApplyCoupon = () => useCartMutation((code: string) => cartApi.applyCoupon(code))
export const useRemoveCoupon = () => useCartMutation(() => cartApi.removeCoupon())
export const useAcknowledgeCart = () => useCartMutation(() => cartApi.acknowledge())

/** Items whose price changed since the collector last saw it. */
export const changedItems = (cart: Cart | undefined) =>
  cart?.items.filter((i) => i.unitPrice !== i.acknowledgedPrice || i.quantity > i.maxQuantity) ?? []
