import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { favoritesApi } from '@/api/client'
import type { Favorites } from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'
import { useSession } from '@/features/auth/session'

export function useFavorites() {
  const { user } = useSession()
  const query = useQuery({
    queryKey: queryKeys.favorites(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: Boolean(user),
  })
  const ids = new Set(query.data?.nftIds ?? [])
  return { ...query, isFavorite: (nftId: string) => ids.has(nftId) }
}

/**
 * Optimistic toggle: the heart flips immediately; on failure the previous
 * list is restored and the error surfaces to the caller for feedback.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const key = queryKeys.favorites(user?.id ?? 'anonymous')

  return useMutation({
    mutationKey: ['favorites', 'toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Favorites>(key)
      const current = previous?.nftIds ?? []
      queryClient.setQueryData<Favorites>(key, {
        nftIds: favorite ? [...new Set([...current, nftId])] : current.filter((id) => id !== nftId),
      })
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      // Only resync once the last concurrent toggle finishes, to avoid flicker.
      if (queryClient.isMutating({ mutationKey: ['favorites', 'toggle'] }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
