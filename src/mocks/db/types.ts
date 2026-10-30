import type { EditionKind, NftDetail, Order, Wallet } from '@/api/contracts'

export type NftRecord = Omit<NftDetail, 'price' | 'soldOut'> & { trendingScore: number }

export interface UserRecord {
  id: string
  username: string
  displayName: string
  email: string
  salt: string
  passwordHash: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  updatedAt: string
}

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: string
}

export interface CartItemRecord {
  id: string
  nftId: string
  editionId: EditionKind
  quantity: number
  acknowledgedPrice: string
}

export interface CartRecord {
  id: string
  userId: string | null
  items: CartItemRecord[]
  couponCode: string | null
  updatedAt: string
  version: number
}

export type WalletRecord = Wallet & { userId: string }

export interface ConnectionRecord {
  id: string
  userId: string
  walletId: string
  network: Wallet['network']
  provider: Wallet['provider']
  address: string
  connectedAt: string
  active: boolean
}

export type OrderRecord = Order & {
  userId: string
  idempotencyKey: string
  requestHash: string
  /** When the simulated chain settles a pending order. */
  resolveAt: string
  outcome: 'confirm' | 'reject'
}

export interface DbState {
  schemaVersion: 1
  nfts: NftRecord[]
  users: UserRecord[]
  sessions: SessionRecord[]
  favorites: Record<string, string[]>
  carts: CartRecord[]
  wallets: WalletRecord[]
  connections: ConnectionRecord[]
  orders: OrderRecord[]
  eventSeq: number
}
