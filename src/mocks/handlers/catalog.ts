import { http, HttpResponse } from 'msw'
import {
  CATEGORIES,
  categorySchema,
  NETWORKS,
  networkSchema,
  nftListParamsSchema,
  type NftListParams,
} from '@/api/contracts'
import { compareEth, ETH_PATTERN } from '@/lib/money'
import { db, defaultEdition, findNft, persist, toDetail, toSummary } from '../db/store'
import type { NftRecord } from '../db/types'
import { mockConfig } from '../scenarios'
import { api, handle, raise, requireUser, zodFieldErrors } from '../utils'

const DEFAULT_PAGE_SIZE = 9
const NEW_WINDOW_MS = 14 * 86400_000

function parseParams(url: URL): NftListParams {
  const get = (k: string) => url.searchParams.get(k) ?? undefined
  const list = (k: string) => get(k)?.split(',').filter(Boolean)
  const num = (k: string) => (get(k) ? Number(get(k)) : undefined)
  const parsed = nftListParamsSchema.safeParse({
    q: get('q'),
    categories: list('categories'),
    networks: list('networks'),
    minPrice: get('minPrice'),
    maxPrice: get('maxPrice'),
    tab: get('tab'),
    sort: get('sort'),
    collection: get('collection'),
    exclude: get('exclude'),
    page: num('page'),
    pageSize: num('pageSize'),
  })
  if (!parsed.success) {
    return raise('VALIDATION_ERROR', 'Parâmetros de busca inválidos.', { fieldErrors: zodFieldErrors(parsed.error) })
  }
  for (const key of ['minPrice', 'maxPrice'] as const) {
    const v = parsed.data[key]
    if (v !== undefined && !ETH_PATTERN.test(v)) raise('VALIDATION_ERROR', 'Faixa de preço inválida.', { fieldErrors: { [key]: 'Valor inválido' } })
  }
  return parsed.data
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function applyFilters(all: NftRecord[], p: NftListParams, opts: { skip?: 'categories' | 'networks' } = {}) {
  const newest = Math.max(...all.map((n) => Date.parse(n.listedAt)))
  const q = p.q ? normalize(p.q) : ''
  return all.filter((n) => {
    if (p.exclude && n.id === p.exclude) return false
    if (p.collection && n.collection.id !== p.collection) return false
    if (q && !normalize(`${n.name} ${n.collection.name} ${n.tokenId}`).includes(q)) return false
    if (opts.skip !== 'categories' && p.categories?.length && !p.categories.includes(n.category)) return false
    if (opts.skip !== 'networks' && p.networks?.length && !p.networks.includes(n.network)) return false
    const price = defaultEdition(n).price
    if (p.minPrice && compareEth(price, p.minPrice) < 0) return false
    if (p.maxPrice && compareEth(price, p.maxPrice) > 0) return false
    if (p.tab === 'novos' && newest - Date.parse(n.listedAt) > NEW_WINDOW_MS) return false
    return true
  })
}

function sortNfts(list: NftRecord[], p: NftListParams) {
  const sorted = [...list]
  const byRecent = (a: NftRecord, b: NftRecord) => b.listedAt.localeCompare(a.listedAt) || a.id.localeCompare(b.id)
  switch (p.sort) {
    case 'preco-asc':
      return sorted.sort((a, b) => compareEth(defaultEdition(a).price, defaultEdition(b).price) || byRecent(a, b))
    case 'preco-desc':
      return sorted.sort((a, b) => compareEth(defaultEdition(b).price, defaultEdition(a).price) || byRecent(a, b))
    case 'nome':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    default:
      if (p.tab === 'em-alta') return sorted.sort((a, b) => b.trendingScore - a.trendingScore || byRecent(a, b))
      return sorted.sort(byRecent)
  }
}

export const catalogHandlers = [
  http.get(
    api('/nfts'),
    handle(({ request }) => {
      const params = parseParams(new URL(request.url))
      const all = mockConfig.current.flags.emptyCatalog ? [] : db.state.nfts
      const filtered = sortNfts(applyFilters(all, params), params)
      const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
      const totalPages = Math.ceil(filtered.length / pageSize)
      const page = params.page ?? 1

      // Facet counts ignore their own dimension so options stay combinable.
      const byCategory = applyFilters(all, params, { skip: 'categories' })
      const byNetwork = applyFilters(all, params, { skip: 'networks' })
      const prices = all.map((n) => defaultEdition(n).price).sort(compareEth)

      return HttpResponse.json({
        items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
        page,
        pageSize,
        total: filtered.length,
        totalPages,
        facets: {
          categories: CATEGORIES.map((value) => ({
            value: categorySchema.parse(value),
            count: byCategory.filter((n) => n.category === value).length,
          })),
          networks: NETWORKS.map((value) => ({
            value: networkSchema.parse(value),
            count: byNetwork.filter((n) => n.network === value).length,
          })),
          priceRange: {
            min: prices[0] ?? '0',
            max: prices.at(-1) ?? '0',
          },
        },
      })
    }),
  ),

  http.get(
    api('/nfts/:id'),
    handle(({ params }) => {
      const nft = findNft(String(params.id))
      if (!nft || mockConfig.current.flags.emptyCatalog) return raise('NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json(toDetail(nft))
    }),
  ),

  http.get(
    api('/me/favorites'),
    handle(({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json({ nftIds: db.state.favorites[user.id] ?? [] })
    }),
  ),

  http.put(
    api('/me/favorites/:nftId'),
    handle(({ request, params }) => {
      const user = requireUser(request)
      const nftId = String(params.nftId)
      if (!findNft(nftId)) raise('NOT_FOUND', 'NFT não encontrado.')
      const list = (db.state.favorites[user.id] ??= [])
      if (!list.includes(nftId)) list.push(nftId)
      persist()
      return HttpResponse.json({ nftIds: list })
    }),
  ),

  http.delete(
    api('/me/favorites/:nftId'),
    handle(({ request, params }) => {
      const user = requireUser(request)
      const list = (db.state.favorites[user.id] ?? []).filter((id) => id !== String(params.nftId))
      db.state.favorites[user.id] = list
      persist()
      return HttpResponse.json({ nftIds: list })
    }),
  ),
]

