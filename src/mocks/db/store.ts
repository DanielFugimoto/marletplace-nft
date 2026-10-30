import type { Edition, NftDetail, NftSummary } from '@/api/contracts'
import { buildSeed } from './seed'
import type { DbState, NftRecord } from './types'

const DB_KEY = 'kurio:mock:db:v1'

function load(): DbState {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === 1) return parsed
    }
  } catch {
    // Corrupted or unavailable storage: fall back to the seed.
  }
  return buildSeed()
}

/**
 * Single source of truth for every mocked resource. REST handlers and the
 * realtime broker both read and write here, so a change is always reflected
 * in both channels. Persisted to localStorage to survive refreshes.
 */
export const db: { state: DbState } = { state: load() }

export function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db.state))
  } catch {
    // Quota exceeded or storage blocked: keep working in memory.
  }
}

export function resetDb() {
  db.state = buildSeed()
  persist()
}

export function nextEventId() {
  db.state.eventSeq += 1
  return `evt-${db.state.eventSeq.toString().padStart(6, '0')}`
}

export const findNft = (id: string) => db.state.nfts.find((n) => n.id === id)
export const findEdition = (nft: NftRecord, editionId: string): Edition | undefined =>
  nft.editions.find((e) => e.id === editionId)

export function defaultEdition(nft: NftRecord): Edition {
  return findEdition(nft, nft.defaultEditionId) ?? nft.editions[0]!
}

export const isSoldOut = (nft: NftRecord) => nft.editions.every((e) => e.available === 0)

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    imageAlt: nft.imageAlt,
    category: nft.category,
    network: nft.network,
    collection: nft.collection,
    price: defaultEdition(nft).price,
    compareAtPrice: nft.compareAtPrice,
    defaultEditionId: nft.defaultEditionId,
    rarity: nft.rarity,
    rating: nft.rating,
    reviewCount: nft.reviewCount,
    soldOut: isSoldOut(nft),
    listedAt: nft.listedAt,
    version: nft.version,
  }
}

export function toDetail(nft: NftRecord): NftDetail {
  const { trendingScore: _ignored, ...rest } = nft
  return { ...rest, ...toSummary(nft) }
}

/** Short, stable hash (FNV-1a) for fingerprints; not for security. */
export function fingerprint(value: unknown): string {
  const input = JSON.stringify(value)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x5bd1e995)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

export async function hashPassword(salt: string, password: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export const nowIso = () => new Date().toISOString()
