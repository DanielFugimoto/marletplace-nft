import { z } from 'zod'
import { ethAmount, id, isoDate, networkSchema } from './common'

export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const categorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof categorySchema>

export const CATEGORY_LABEL: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const EDITION_KINDS = ['1-1', '1-10', '1-50', 'open'] as const
export const editionKindSchema = z.enum(EDITION_KINDS)
export type EditionKind = z.infer<typeof editionKindSchema>

export const editionSchema = z.object({
  id: editionKindSchema,
  label: z.string(),
  price: ethAmount,
  /** Units still for sale. 0 means sold out. */
  available: z.number().int().min(0),
  /** Max units per order, independent of availability. */
  maxPerOrder: z.number().int().min(1),
})
export type Edition = z.infer<typeof editionSchema>

export const nftSummarySchema = z.object({
  id,
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  category: categorySchema,
  network: networkSchema,
  collection: z.object({ id, name: z.string() }),
  /** Price of the default edition, shown on cards. */
  price: ethAmount,
  compareAtPrice: ethAmount.nullable(),
  defaultEditionId: editionKindSchema,
  rarity: z.enum(['comum', 'raro']),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  soldOut: z.boolean(),
  listedAt: isoDate,
  /** Monotonic resource version, shared with realtime events. */
  version: z.number().int().min(1),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const reviewSchema = z.object({
  id,
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: isoDate,
})

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  longDescription: z.array(z.string()),
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })),
  attributes: z.array(z.string()),
  editions: z.array(editionSchema),
  contract: z.object({ address: z.string(), standard: z.string(), royaltyPercent: z.number() }),
  reviews: z.array(reviewSchema),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

export const NFT_TABS = ['todos', 'novos', 'em-alta'] as const
export const NFT_SORTS = ['recentes', 'preco-asc', 'preco-desc', 'nome'] as const

export const nftListParamsSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categories: z.array(categorySchema).optional(),
  networks: z.array(networkSchema).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  tab: z.enum(NFT_TABS).optional(),
  sort: z.enum(NFT_SORTS).optional(),
  collection: z.string().optional(),
  exclude: z.string().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(48).optional(),
})
export type NftListParams = z.infer<typeof nftListParamsSchema>
export type NftTab = (typeof NFT_TABS)[number]
export type NftSort = (typeof NFT_SORTS)[number]

const facetSchema = <T extends z.ZodType>(value: T) => z.array(z.object({ value, count: z.number().int() }))

export const nftListResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: facetSchema(categorySchema),
    networks: facetSchema(networkSchema),
    priceRange: z.object({ min: ethAmount, max: ethAmount }),
  }),
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>
