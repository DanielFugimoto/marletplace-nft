import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { nftApi } from '@/api/client'
import type { NftListParams } from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'

export function nftListQuery(params: NftListParams) {
  return queryOptions({
    queryKey: queryKeys.nfts.list(params),
    // The signal aborts superseded requests; the per-params key means a late
    // response can only ever land in its own cache entry, never in the current one.
    queryFn: ({ signal }) => nftApi.list(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function nftDetailQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: ({ signal }) => nftApi.detail(id, { signal }),
    staleTime: 30_000,
  })
}
