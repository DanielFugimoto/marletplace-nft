import { http, HttpResponse } from 'msw'
import {
  changePasswordSchema,
  connectWalletSchema,
  createWalletSchema,
  MAX_AVATAR_BYTES,
  type Profile,
  updateAvatarSchema,
  updateProfileSchema,
  walletInputSchema,
} from '@/api/contracts'
import { randomUuid } from '@/lib/crypto'
import { db, hashPassword, newId, nowIso, persist } from '../db/store'
import type { UserRecord, WalletRecord } from '../db/types'
import { mockConfig } from '../scenarios'
import { api, handle, parseBody, raise, requireUser } from '../utils'

const toProfile = (u: UserRecord): Profile => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  email: u.email,
  ensName: u.ensName,
  walletNickname: u.walletNickname,
  avatarUrl: u.avatarUrl,
  updatedAt: u.updatedAt,
})

const toWallet = ({ userId: _u, ...wallet }: WalletRecord) => wallet

function ownedWallet(userId: string, id: string) {
  const wallet = db.state.wallets.find((w) => w.id === id && w.userId === userId)
  return wallet ?? raise('NOT_FOUND', 'Carteira não encontrada.')
}

export const accountHandlers = [
  http.get(
    api('/me/profile'),
    handle(({ request }) => HttpResponse.json(toProfile(requireUser(request)))),
  ),

  http.patch(
    api('/me/profile'),
    handle(async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, updateProfileSchema)
      const others = db.state.users.filter((u) => u.id !== user.id)
      if (others.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
        raise('EMAIL_TAKEN', 'Este e-mail já pertence a outra conta.', { fieldErrors: { email: 'E-mail já cadastrado' } })
      }
      if (others.some((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
        raise('USERNAME_TAKEN', 'Nome de usuário indisponível.', { fieldErrors: { username: 'Nome de usuário em uso' } })
      }
      Object.assign(user, body, { email: body.email.toLowerCase(), updatedAt: nowIso() })
      persist()
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.put(
    api('/me/avatar'),
    handle(async ({ request }) => {
      const user = requireUser(request)
      const { dataUrl } = await parseBody(request, updateAvatarSchema)
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const bytes = Math.floor((base64.length * 3) / 4)
      if (bytes > MAX_AVATAR_BYTES) {
        raise('VALIDATION_ERROR', 'A imagem deve ter no máximo 512 KB.', { fieldErrors: { avatar: 'Máximo de 512 KB' } })
      }
      user.avatarUrl = dataUrl
      user.updatedAt = nowIso()
      persist()
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.delete(
    api('/me/avatar'),
    handle(({ request }) => {
      const user = requireUser(request)
      user.avatarUrl = null
      user.updatedAt = nowIso()
      persist()
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.post(
    api('/me/password'),
    handle(async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, changePasswordSchema)
      if ((await hashPassword(user.salt, body.currentPassword)) !== user.passwordHash) {
        raise('INVALID_PASSWORD', 'Senha atual incorreta.', { fieldErrors: { currentPassword: 'Senha atual incorreta' } })
      }
      user.salt = randomUuid()
      user.passwordHash = await hashPassword(user.salt, body.newPassword)
      user.updatedAt = nowIso()
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    api('/me/wallets'),
    handle(({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json(db.state.wallets.filter((w) => w.userId === user.id).map(toWallet))
    }),
  ),

  http.post(
    api('/me/wallets'),
    handle(async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, createWalletSchema)
      if (db.state.wallets.some((w) => w.userId === user.id && w.slot === body.slot)) {
        raise('VALIDATION_ERROR', 'Você já cadastrou esta carteira. Edite a existente.', {
          fieldErrors: { slot: 'Carteira já cadastrada' },
          status: 409,
        })
      }
      const wallet: WalletRecord = { ...body, id: newId('wallet'), userId: user.id, updatedAt: nowIso() }
      db.state.wallets.push(wallet)
      persist()
      return HttpResponse.json(toWallet(wallet), { status: 201 })
    }),
  ),

  http.put(
    api('/me/wallets/:id'),
    handle(async ({ request, params }) => {
      const user = requireUser(request)
      const wallet = ownedWallet(user.id, String(params.id))
      const body = await parseBody(request, walletInputSchema)
      Object.assign(wallet, body, { updatedAt: nowIso() })
      // Editing a wallet invalidates any live connection to it.
      db.state.connections.forEach((c) => {
        if (c.walletId === wallet.id) c.active = false
      })
      persist()
      return HttpResponse.json(toWallet(wallet))
    }),
  ),

  http.post(
    api('/wallet-connections'),
    handle(async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, connectWalletSchema)
      const wallet = ownedWallet(user.id, body.walletId)
      if (mockConfig.current.flags.walletRejects) {
        raise('WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      }
      db.state.connections.forEach((c) => {
        if (c.userId === user.id) c.active = false
      })
      const connection = {
        id: newId('conn'),
        userId: user.id,
        walletId: wallet.id,
        network: body.network,
        provider: wallet.provider,
        address: wallet.address,
        connectedAt: nowIso(),
        active: true,
      }
      db.state.connections.push(connection)
      persist()
      const { userId: _u, active: _a, ...view } = connection
      return HttpResponse.json(view, { status: 201 })
    }),
  ),

  http.get(
    api('/wallet-connections/:id'),
    handle(({ request, params }) => {
      const user = requireUser(request)
      const connection = db.state.connections.find((c) => c.id === params.id && c.userId === user.id && c.active)
      if (!connection) raise('WALLET_DISCONNECTED', 'A carteira está desconectada.')
      const { userId: _u, active: _a, ...view } = connection!
      return HttpResponse.json(view)
    }),
  ),

  http.delete(
    api('/wallet-connections/:id'),
    handle(({ request, params }) => {
      const user = requireUser(request)
      db.state.connections.forEach((c) => {
        if (c.id === params.id && c.userId === user.id) c.active = false
      })
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
