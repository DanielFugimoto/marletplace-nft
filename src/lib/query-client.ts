import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

const MAX_RETRIES = 2

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Only transient failures (network/5xx/408/429) are worth retrying.
          if (isAxiosError(error)) {
            const status = error.response?.status
            if (status && status < 500 && status !== 408 && status !== 429) return false
          }
          return failureCount < MAX_RETRIES
        },
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
      },
      mutations: {
        // Mutations are never retried automatically; order creation relies on
        // an explicit idempotency key instead.
        retry: false,
      },
    },
  })
}
