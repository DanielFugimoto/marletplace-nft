import axios, { AxiosHeaders, type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { env } from '@/env'
import { credentials } from './credentials'
import { ApiError, TIMEOUT_REASON, toApiError } from './errors'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Request timeout in ms, enforced with setTimeout so test clocks control it. */
    timeoutMs?: number
    /** Skip the global session-expired handler (e.g. for the session probe itself). */
    skipAuthRedirect?: boolean
  }
}

export const DEFAULT_TIMEOUT_MS = 10_000

export const http = axios.create({
  baseURL: env.apiUrl,
  headers: { Accept: 'application/json' },
})

type SessionExpiredHandler = (error: ApiError) => void
let onSessionExpired: SessionExpiredHandler | null = null
export const setSessionExpiredHandler = (handler: SessionExpiredHandler | null) => {
  onSessionExpired = handler
}

http.interceptors.request.use((config) => {
  const session = credentials.getSession()
  if (session) config.headers.set('Authorization', `Bearer ${session.token}`)
  const cartId = credentials.getGuestCartId()
  if (cartId) config.headers.set('X-Cart-Id', cartId)

  // Combine the caller's AbortSignal (TanStack Query cancellation) with our timeout.
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(TIMEOUT_REASON), config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signals = [timeout.signal, config.signal].filter(Boolean) as AbortSignal[]
  const signal = signals.length > 1 ? AbortSignal.any(signals) : timeout.signal
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  config.signal = signal
  ;(config as { __timer?: ReturnType<typeof setTimeout> }).__timer = timer
  return config
})

http.interceptors.response.use(
  (response) => {
    clearTimeout((response.config as { __timer?: ReturnType<typeof setTimeout> }).__timer)
    return response
  },
  (error: unknown) => {
    const config = (error as { config?: AxiosRequestConfig & { __timer?: ReturnType<typeof setTimeout> } }).config
    clearTimeout(config?.__timer)
    let apiError = toApiError(error)
    // AbortSignal.any loses the reason in some engines; recover it from the config signal.
    if (apiError.code === 'CANCELLED' && (config?.signal as AbortSignal | undefined)?.reason === TIMEOUT_REASON) {
      apiError = new ApiError({ status: null, code: 'TIMEOUT', cause: error })
    }
    const sentToken = AxiosHeaders.from(config?.headers as AxiosHeaders | undefined).has('Authorization')
    if (apiError.isAuthError && sentToken && !config?.skipAuthRedirect) onSessionExpired?.(apiError)
    return Promise.reject(apiError)
  },
)

/** Performs a request and validates the response body against its contract. */
export async function request<S extends z.ZodType>(schema: S, config: AxiosRequestConfig): Promise<z.infer<S>> {
  const response = await http.request(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('[api] contract violation', config.url, parsed.error.issues)
    throw new ApiError({ status: response.status, code: 'INVALID_RESPONSE', details: parsed.error.issues })
  }
  return parsed.data
}

/** For endpoints that answer 204 No Content. */
export async function send(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
