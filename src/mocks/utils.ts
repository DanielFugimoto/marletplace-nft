import { HttpResponse, type PathParams } from 'msw'
import type { z } from 'zod'
import type { ErrorCode } from '@/api/contracts'
import { env } from '@/env'
import { db, nowIso, persist } from './db/store'
import type { UserRecord } from './db/types'

const base = env.apiUrl.replace(/\/$/, '')
export const api = (path: string) => `${base}${path}`
export const apiRelative = (url: string) => {
  const { pathname } = new URL(url)
  const basePath = new URL(base, window.location.origin).pathname.replace(/\/$/, '')
  return pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname
}

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  INVALID_PASSWORD: 422,
  AVAILABILITY_CONFLICT: 409,
  EDITION_UNAVAILABLE: 409,
  QUANTITY_LIMIT: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  QUOTE_CHANGED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  WALLET_REJECTED: 403,
  WALLET_DISCONNECTED: 409,
  CART_EMPTY: 409,
  TRANSIENT: 503,
  INTERNAL: 500,
}

export function fail(
  code: ErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown; status?: number } = {},
) {
  return HttpResponse.json(
    { error: { code, message, fieldErrors: extra.fieldErrors, details: extra.details } },
    { status: extra.status ?? STATUS[code] },
  )
}

/** Thrown inside handlers to short-circuit with an error response. */
export class MockHttpError extends Error {
  readonly response: Response
  constructor(response: Response) {
    super('mock http error')
    this.response = response
  }
}

export const raise = (...args: Parameters<typeof fail>): never => {
  throw new MockHttpError(fail(...args))
}

/** Wraps a resolver so `raise()` and validation failures become responses. */
export interface HandlerArgs {
  request: Request
  params: PathParams
}

export function handle(resolver: (args: HandlerArgs) => Promise<Response> | Response) {
  return async (args: HandlerArgs) => {
    try {
      return await resolver(args)
    } catch (error) {
      if (error instanceof MockHttpError) return error.response
      console.error('[mocks] handler crashed', error)
      return fail('INTERNAL', 'Erro interno do servidor simulado.')
    }
  }
}

export function zodFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    fieldErrors[key] ??= issue.message
  }
  return fieldErrors
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return raise('VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return raise('VALIDATION_ERROR', 'Verifique os campos destacados.', { fieldErrors: zodFieldErrors(parsed.error) })
  }
  return parsed.data
}

export function bearerToken(request: Request) {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

/** Resolves the session user or raises 401. Data is always scoped by this id. */
export function requireUser(request: Request): UserRecord {
  const token = bearerToken(request)
  if (!token) return raise('UNAUTHENTICATED', 'Faça login para continuar.')
  const session = db.state.sessions.find((s) => s.token === token)
  if (!session) return raise('UNAUTHENTICATED', 'Sua sessão não é mais válida. Faça login novamente.')
  if (Date.parse(session.expiresAt) <= Date.now()) {
    db.state.sessions = db.state.sessions.filter((s) => s.token !== token)
    persist()
    return raise('SESSION_EXPIRED', 'Sua sessão expirou. Faça login novamente para continuar.')
  }
  const user = db.state.users.find((u) => u.id === session.userId)
  if (!user) return raise('UNAUTHENTICATED', 'Usuário não encontrado.')
  return user
}

export function optionalUser(request: Request): UserRecord | null {
  return bearerToken(request) ? requireUser(request) : null
}

export { nowIso }
