import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { authApi } from '@/api/client'
import type { LoginResponse, Session } from '@/api/contracts'
import { credentials } from '@/api/credentials'
import { isApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'

export function sessionQuery(token: string | null) {
  return queryOptions({
    queryKey: queryKeys.session(token),
    queryFn: async ({ signal }): Promise<Session | null> => {
      if (!token) return null
      try {
        return await authApi.session({ signal })
      } catch (error) {
        // An invalid or expired token simply means "signed out".
        if (isApiError(error) && error.isAuthError) {
          credentials.setSession(null)
          return null
        }
        throw error
      }
    },
    staleTime: 5 * 60_000,
    // Never retry auth probes on 401; network failures retry via defaults.
  })
}

const subscribe = (cb: () => void) => credentials.subscribe(cb)
const getToken = () => credentials.getSession()?.token ?? null
const getGuestCartId = () => credentials.getGuestCartId()

export function useToken() {
  return useSyncExternalStore(subscribe, getToken, getToken)
}

export function useGuestCartId() {
  return useSyncExternalStore(subscribe, getGuestCartId, getGuestCartId)
}

/** Current user (null when signed out). Suspends nothing; `isPending` covers the first probe. */
export function useSession() {
  const token = useToken()
  const query = useQuery(sessionQuery(token))
  return {
    ...query,
    user: query.data?.user ?? null,
    isAuthenticated: Boolean(query.data?.user),
  }
}

/** Drops every private cache entry (all users, guest carts) and in-flight requests for them. */
export function clearPrivateData(queryClient: QueryClient) {
  void queryClient.cancelQueries({ queryKey: queryKeys.private })
  queryClient.removeQueries({ queryKey: queryKeys.private })
}

/** Called after login/register: stores credentials and resets per-user caches. */
export function establishSession(queryClient: QueryClient, response: LoginResponse) {
  clearPrivateData(queryClient)
  // The guest cart was merged (or is now irrelevant): the user cart takes over.
  credentials.setGuestCartId(null)
  credentials.setSession({ token: response.token, userId: response.user.id, expiresAt: response.expiresAt })
  queryClient.setQueryData(queryKeys.session(response.token), {
    token: response.token,
    expiresAt: response.expiresAt,
    user: response.user,
  })
}

export function endSession(queryClient: QueryClient) {
  credentials.setSession(null)
  clearPrivateData(queryClient)
  queryClient.removeQueries({ queryKey: ['session'] })
}
