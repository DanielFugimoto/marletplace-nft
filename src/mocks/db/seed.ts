import {
  CATEGORIES,
  type Category,
  type Edition,
  type EditionKind,
  NETWORKS,
  type Network,
  type WalletProvider,
} from '@/api/contracts'
import { mulEth } from '@/lib/money'
import type { DbState, NftRecord, UserRecord, WalletRecord } from './types'

/** Deterministic PRNG so every reset produces the exact same catalog. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const SEED_NOW = '2026-10-20T12:00:00.000Z'

interface Art {
  image: string
  alt: string
  collection: { id: string; name: string }
  attributes: string[]
}

const ARTS: Record<string, Art> = {
  emerald: {
    image: 'emerald-ape',
    alt: 'Ilustração de um macaco de pelo castanho com óculos redondos verdes e jaqueta college verde com corrente dourada',
    collection: { id: 'kurio-apes', name: 'Kurio Apes' },
    attributes: ['Óculos', 'Esmeralda', 'Raro'],
  },
  nomad: {
    image: 'nomad-bucket-hat',
    alt: 'Ilustração de um gorila cinza sorridente com chapéu bucket verde e moletom roxo',
    collection: { id: 'nomad-club', name: 'Nomad Club' },
    attributes: ['Chapéu bucket', 'Moletom', 'Sereno'],
  },
  baron: {
    image: 'baron-black-ape',
    alt: 'Ilustração de um macaco de pelo preto com blazer creme e gola alta verde-escura',
    collection: { id: 'baron-society', name: 'Baron Society' },
    attributes: ['Blazer', 'Brinco', 'Elegante'],
  },
  golden: {
    image: 'golden-headphones',
    alt: 'Ilustração de um macaco de pelo dourado com fones de ouvido verdes e jaqueta creme',
    collection: { id: 'golden-frequencies', name: 'Golden Frequencies' },
    attributes: ['Fones', 'Dourado', 'Música'],
  },
}

/** The pieces that appear in the Figma layout, kept with their exact prices. */
const FEATURED: Array<{
  name: string
  token: string
  art: keyof typeof ARTS
  price: string
  compareAt?: string
  rare?: boolean
  category: Category
  network: Network
}> = [
  { name: 'Emerald Ape', token: '042', art: 'emerald', price: '1.19', category: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad', token: '009', art: 'nomad', price: '1.69', category: 'arte-digital', network: 'ethereum' },
  {
    name: 'Neon Vessel',
    token: '552',
    art: 'baron',
    price: '1.99',
    compareAt: '2.29',
    rare: true,
    category: 'colecionaveis',
    network: 'ethereum',
  },
  { name: 'Cosmic Bloom', token: '118', art: 'nomad', price: '1.29', category: 'arte-3d', network: 'polygon' },
  { name: 'Violet Nomad', token: '314', art: 'nomad', price: '1.39', category: 'arte-digital', network: 'ethereum' },
  { name: 'Ivory Baron', token: '088', art: 'baron', price: '1.79', category: 'colecionaveis', network: 'ethereum' },
  { name: 'Golden Beat', token: '207', art: 'golden', price: '0.99', category: 'musica', network: 'polygon' },
  { name: 'Golden Frequency', token: '071', art: 'golden', price: '0.59', category: 'musica', network: 'solana' },
  { name: 'Golden Signal', token: '160', art: 'golden', price: '0.39', category: 'musica', network: 'solana' },
]

const ADJECTIVES = [
  'Amber', 'Rustic', 'Lunar', 'Velvet', 'Silent', 'Copper', 'Midnight', 'Crimson', 'Jade', 'Solar',
  'Misty', 'Royal', 'Wild', 'Quiet', 'Atomic', 'Dusty', 'Urban', 'Ancient', 'Electric', 'Hidden',
]
const NOUNS: Record<keyof typeof ARTS, string[]> = {
  emerald: ['Ape', 'Primate', 'Scholar', 'Captain'],
  nomad: ['Nomad', 'Wanderer', 'Drifter', 'Pilgrim'],
  baron: ['Baron', 'Duke', 'Vessel', 'Curator'],
  golden: ['Beat', 'Signal', 'Rhythm', 'Echo'],
}

const EDITION_SPECS: Array<{ id: EditionKind; label: string; factor: string; supply: number; maxPerOrder: number }> = [
  { id: '1-1', label: '1/1', factor: '4', supply: 1, maxPerOrder: 1 },
  { id: '1-10', label: '1/10', factor: '2', supply: 10, maxPerOrder: 5 },
  { id: '1-50', label: '1/50', factor: '1', supply: 50, maxPerOrder: 10 },
  { id: 'open', label: 'ABERTA', factor: '0.5', supply: 500, maxPerOrder: 20 },
]

function buildEditions(basePrice: string, rand: () => number, opts: { soldOutEdition?: EditionKind } = {}): Edition[] {
  return EDITION_SPECS.map((spec) => {
    const sold = Math.floor(rand() * spec.supply * 0.6)
    const available = opts.soldOutEdition === spec.id ? 0 : Math.max(spec.supply - sold, spec.id === '1-1' ? 1 : 2)
    return {
      id: spec.id,
      label: spec.label,
      price: mulEth(basePrice, spec.factor),
      available,
      maxPerOrder: spec.maxPerOrder,
    }
  })
}

const REVIEW_TEMPLATES = [
  { author: 'lia.eth', rating: 5, comment: 'Acabamento impecável e a procedência ficou clara desde o primeiro minuto.' },
  { author: 'marcos_coleciona', rating: 5, comment: 'Entrou direto para a vitrine da minha coleção. Atendimento rápido.' },
  { author: 'nina.art', rating: 4, comment: 'Arte linda; gostaria de mais detalhes sobre os desbloqueáveis.' },
]

function slug(name: string, token: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${token}`
}

function buildNft(
  index: number,
  input: {
    name: string
    token: string
    art: keyof typeof ARTS
    price: string
    compareAt?: string
    rare?: boolean
    category: Category
    network: Network
  },
  rand: () => number,
): NftRecord {
  const art = ARTS[input.art]!
  const id = slug(input.name, input.token)
  const listedAt = new Date(Date.parse(SEED_NOW) - index * 36 * 3600_000).toISOString()
  // A couple of pieces start with sold-out editions to exercise unavailable states.
  const soldOutEdition: EditionKind | undefined = index % 7 === 3 ? '1-1' : undefined
  const editions = buildEditions(input.price, rand, { soldOutEdition })
  const fullName = `${input.name} #${input.token}`
  return {
    id,
    name: fullName,
    tokenId: `#${input.token.padStart(4, '0')}`,
    image: art.image,
    imageAlt: art.alt,
    category: input.category,
    network: input.network,
    collection: art.collection,
    compareAtPrice: input.compareAt ?? null,
    defaultEditionId: '1-50',
    rarity: input.rare ? 'raro' : 'comum',
    rating: Math.round((4 + rand()) * 10) / 10,
    reviewCount: 3 + Math.floor(rand() * 40),
    listedAt,
    trendingScore: Math.floor(rand() * 1000),
    version: 1,
    description: `Um colecionável digital finalizado à mão da coleção ${art.collection.name}, verificado na ${
      input.network === 'ethereum' ? 'Ethereum' : input.network === 'polygon' ? 'Polygon' : 'Solana'
    }, com arte desbloqueável e acesso para colecionadores.`,
    longDescription: [
      `${fullName} é uma obra digital finalizada à mão da coleção ${art.collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    gallery: [0, 1, 2, 3].map((n) => ({ src: art.image, alt: `${fullName}, vista ${n + 1} de 4` })),
    attributes: art.attributes,
    editions,
    contract: {
      address: `0x7A42${(index * 7919).toString(16).padStart(6, '0').toUpperCase()}19E8`,
      standard: 'ERC-721',
      royaltyPercent: 5,
    },
    reviews: REVIEW_TEMPLATES.map((r, n) => ({
      id: `${id}-review-${n}`,
      ...r,
      createdAt: new Date(Date.parse(listedAt) + (n + 1) * 86400_000).toISOString(),
    })),
  }
}

export function buildCatalog(): NftRecord[] {
  const rand = mulberry32(20261029)
  const nfts: NftRecord[] = FEATURED.map((f, i) => buildNft(i, f, rand))
  const artKeys = Object.keys(ARTS) as Array<keyof typeof ARTS>
  for (let i = 0; nfts.length < 45; i++) {
    const art = artKeys[i % artKeys.length]!
    const nouns = NOUNS[art]!
    const name = `${ADJECTIVES[i % ADJECTIVES.length]} ${nouns[Math.floor(i / artKeys.length) % nouns.length]}`
    const token = String(200 + ((i * 37) % 800)).padStart(3, '0')
    const price = (0.05 + rand() * 12.25).toFixed(2)
    nfts.push(
      buildNft(
        nfts.length,
        {
          name,
          token,
          art,
          price,
          compareAt: i % 9 === 4 ? (Number(price) + 0.3).toFixed(2) : undefined,
          rare: i % 6 === 2,
          category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)]!,
          network: NETWORKS[Math.floor(rand() * NETWORKS.length)]!,
        },
        rand,
      ),
    )
  }
  return nfts
}

const wallet = (
  userId: string,
  id: string,
  slot: 'primary' | 'secondary',
  provider: WalletProvider,
  network: Network,
  overrides: Partial<WalletRecord>,
): WalletRecord => ({
  id,
  userId,
  slot,
  provider,
  network,
  displayName: '',
  nickname: '',
  profileName: '',
  address: '',
  secondaryAddress: '',
  referralCode: 'KURIO-01',
  email: '',
  ensName: '',
  updatedAt: SEED_NOW,
  ...overrides,
})

/**
 * Demo credentials (documented in the README). Only salted SHA-256 hashes are
 * stored; the plain password is never persisted.
 */
export const SEED_USERS: UserRecord[] = [
  {
    id: 'user-ana',
    username: 'ana.colecionadora',
    displayName: 'Ana Ribeiro',
    email: 'ana@kurio.dev',
    salt: 's4lt-ana-01',
    passwordHash: '6dc229f0d749cf0821133058b238256f86b536ef4b5c18a7e9a7efe59439dd0e',
    ensName: 'ana',
    walletNickname: 'Cofre principal',
    avatarUrl: null,
    updatedAt: SEED_NOW,
  },
  {
    id: 'user-bruno',
    username: 'bruno.nft',
    displayName: 'Bruno Costa',
    email: 'bruno@kurio.dev',
    salt: 's4lt-bruno-02',
    passwordHash: '35bb74146abc4b980215fb9b943fc2a2db1d4b3a013b7022c717bdea45c4f2c2',
    ensName: 'bruno',
    walletNickname: 'Carteira do Bruno',
    avatarUrl: null,
    updatedAt: SEED_NOW,
  },
]

export function buildSeed(): DbState {
  return {
    schemaVersion: 1,
    nfts: buildCatalog(),
    users: structuredClone(SEED_USERS),
    sessions: [],
    favorites: { 'user-ana': ['emerald-ape-042', 'ivory-baron-088'], 'user-bruno': ['golden-beat-207'] },
    carts: [],
    wallets: [
      wallet('user-ana', 'wallet-ana-primary', 'primary', 'metamask', 'ethereum', {
        displayName: 'Ana Ribeiro',
        nickname: 'Principal',
        profileName: 'ana.colecionadora',
        address: '0xA91F3c2B7d4E5f60718293a4B5c6D7e8F9a0E82C',
        email: 'ana@kurio.dev',
        ensName: 'ana',
      }),
      wallet('user-ana', 'wallet-ana-secondary', 'secondary', 'coinbase', 'polygon', {
        displayName: 'Ana Ribeiro',
        nickname: 'Reserva',
        profileName: 'ana.colecionadora',
        address: '0x3B2a9C8d7E6f5A4b3C2d1E0f9A8b7C6d5E4f3A21',
        secondaryAddress: 'nova.kurio.eth',
        email: 'ana@kurio.dev',
        ensName: 'nova.kurio',
      }),
      wallet('user-bruno', 'wallet-bruno-primary', 'primary', 'walletconnect', 'ethereum', {
        displayName: 'Bruno Costa',
        nickname: 'Principal',
        profileName: 'bruno.nft',
        address: '0x5C4b3A2918F7e6D5c4B3a29180F7E6d5C4b3A291',
        email: 'bruno@kurio.dev',
        ensName: 'bruno',
      }),
    ],
    connections: [],
    orders: [],
    eventSeq: 0,
  }
}
