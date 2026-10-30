import { isAxiosError, isCancel } from 'axios'
import { apiErrorBodySchema, type ErrorCode } from './contracts'

export type ClientErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'CANCELLED'

const FALLBACK_MESSAGE: Partial<Record<ClientErrorCode, string>> = {
  NETWORK: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
  TIMEOUT: 'O servidor demorou para responder. Tente novamente.',
  INVALID_RESPONSE: 'Recebemos uma resposta inesperada do servidor.',
  TRANSIENT: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  INTERNAL: 'Ocorreu um erro inesperado. Tente novamente.',
  CANCELLED: 'Requisição cancelada.',
}

export class ApiError extends Error {
  readonly status: number | null
  readonly code: ClientErrorCode
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(init: {
    status: number | null
    code: ClientErrorCode
    message?: string
    fieldErrors?: Record<string, string>
    details?: unknown
    cause?: unknown
  }) {
    super(init.message ?? FALLBACK_MESSAGE[init.code] ?? 'Erro inesperado.', { cause: init.cause })
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
  }

  /** Failures where retrying the same request may succeed. */
  get isTransient() {
    return (
      this.code === 'NETWORK' ||
      this.code === 'TIMEOUT' ||
      this.code === 'TRANSIENT' ||
      (this.status !== null && this.status >= 500)
    )
  }

  get isAuthError() {
    return this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED'
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isCancel(error)) {
    // Our own timeout aborts carry a marker reason.
    const reason = (error as { config?: { signal?: AbortSignal } }).config?.signal?.reason
    if (reason === TIMEOUT_REASON) return new ApiError({ status: null, code: 'TIMEOUT', cause: error })
    return new ApiError({ status: null, code: 'CANCELLED', cause: error })
  }
  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError({ status: null, code: error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK', cause: error })
    }
    const parsed = apiErrorBodySchema.safeParse(error.response.data)
    if (parsed.success) {
      const { code, message, fieldErrors, details } = parsed.data.error
      return new ApiError({ status: error.response.status, code, message, fieldErrors, details, cause: error })
    }
    const status = error.response.status
    return new ApiError({ status, code: status >= 500 ? 'INTERNAL' : 'INVALID_RESPONSE', cause: error })
  }
  return new ApiError({ status: null, code: 'INTERNAL', cause: error })
}

export const TIMEOUT_REASON = 'kurio:timeout'
