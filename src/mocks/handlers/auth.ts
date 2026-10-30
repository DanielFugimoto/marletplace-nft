import { http, HttpResponse } from 'msw'
import { loginRequestSchema, registerRequestSchema, type User } from '@/api/contracts'
import { db, hashPassword, newId, nowIso, persist } from '../db/store'
import type { UserRecord } from '../db/types'
import { mergeGuestCart } from '../domain/cart'
import { disconnectUser } from '../realtime'
import { mockConfig } from '../scenarios'
import { api, bearerToken, handle, parseBody, raise, requireUser } from '../utils'

export const toUser = (u: UserRecord): User => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  email: u.email,
  avatarUrl: u.avatarUrl,
})

function createSession(user: UserRecord) {
  const token = `tok_${crypto.randomUUID().replaceAll('-', '')}`
  const expiresAt = new Date(Date.now() + mockConfig.current.flags.sessionTtlMs).toISOString()
  db.state.sessions.push({ token, userId: user.id, expiresAt })
  return { token, expiresAt, user: toUser(user) }
}

export const authHandlers = [
  http.post(
    api('/auth/register'),
    handle(async ({ request }) => {
      const body = await parseBody(request, registerRequestSchema)
      const email = body.email.toLowerCase()
      const fieldErrors: Record<string, string> = {}
      if (db.state.users.some((u) => u.email.toLowerCase() === email)) fieldErrors.email = 'Este e-mail já está cadastrado'
      if (db.state.users.some((u) => u.username.toLowerCase() === body.username.toLowerCase()))
        fieldErrors.username = 'Este nome de usuário já está em uso'
      if (fieldErrors.email) raise('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', { fieldErrors })
      if (fieldErrors.username) raise('USERNAME_TAKEN', 'Nome de usuário indisponível.', { fieldErrors })

      const salt = crypto.randomUUID()
      const user: UserRecord = {
        id: newId('user'),
        username: body.username,
        displayName: body.username,
        email,
        salt,
        passwordHash: await hashPassword(salt, body.password),
        ensName: '',
        walletNickname: '',
        avatarUrl: null,
        updatedAt: nowIso(),
      }
      db.state.users.push(user)
      const session = createSession(user)
      const cartMerged = mergeGuestCart(request.headers.get('X-Cart-Id'), user.id)
      persist()
      return HttpResponse.json({ ...session, cartMerged }, { status: 201 })
    }),
  ),

  http.post(
    api('/auth/login'),
    handle(async ({ request }) => {
      const body = await parseBody(request, loginRequestSchema)
      const user = db.state.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase())
      const hash = user ? await hashPassword(user.salt, body.password) : null
      if (!user || hash !== user.passwordHash) {
        raise('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.', {
          fieldErrors: { password: 'E-mail ou senha incorretos' },
        })
      }
      const session = createSession(user!)
      const cartMerged = mergeGuestCart(request.headers.get('X-Cart-Id'), user!.id)
      persist()
      return HttpResponse.json({ ...session, cartMerged })
    }),
  ),

  http.get(
    api('/auth/session'),
    handle(({ request }) => {
      const user = requireUser(request)
      const session = db.state.sessions.find((s) => s.token === bearerToken(request))!
      return HttpResponse.json({ token: session.token, expiresAt: session.expiresAt, user: toUser(user) })
    }),
  ),

  http.post(
    api('/auth/logout'),
    handle(({ request }) => {
      const token = bearerToken(request)
      const session = db.state.sessions.find((s) => s.token === token)
      db.state.sessions = db.state.sessions.filter((s) => s.token !== token)
      persist()
      // Server side also drops the user's sockets so no private event leaks after logout.
      if (session) disconnectUser(session.userId)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
