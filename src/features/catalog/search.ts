import { z } from 'zod'
import { categorySchema, networkSchema, NFT_SORTS, NFT_TABS, type NftListParams } from '@/api/contracts'
import { ETH_PATTERN } from '@/lib/money'

/**
 * Catalog state lives in the URL so it survives refresh and history
 * navigation. Invalid values are dropped instead of breaking the page.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  categories: z.array(categorySchema).optional().catch(undefined),
  networks: z.array(networkSchema).optional().catch(undefined),
  minPrice: z.string().regex(ETH_PATTERN).optional().catch(undefined),
  maxPrice: z.string().regex(ETH_PATTERN).optional().catch(undefined),
  tab: z.enum(NFT_TABS).optional().catch(undefined),
  sort: z.enum(NFT_SORTS).optional().catch(undefined),
  page: z.number().int().min(1).max(999).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const CATALOG_PAGE_SIZE = 9

export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q || undefined,
    categories: search.categories?.length ? [...search.categories].sort() : undefined,
    networks: search.networks?.length ? [...search.networks].sort() : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab,
    sort: search.sort,
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

export const SORT_LABEL: Record<(typeof NFT_SORTS)[number], string> = {
  recentes: 'Listados recentemente',
  'preco-asc': 'Menor preço',
  'preco-desc': 'Maior preço',
  nome: 'Nome (A–Z)',
}

export const TAB_LABEL: Record<(typeof NFT_TABS)[number], string> = {
  todos: 'Todos os NFTs',
  novos: 'Novos lançamentos',
  'em-alta': 'Em alta',
}
