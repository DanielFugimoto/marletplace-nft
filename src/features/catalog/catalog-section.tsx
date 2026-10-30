import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useSearch } from '@tanstack/react-router'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL, NETWORK_LABEL, NFT_SORTS, NFT_TABS } from '@/api/contracts'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { CatalogFilters } from './catalog-filters'
import { FeaturedOffer } from './featured-offer'
import { NftCard, NftCardSkeleton } from './nft-card'
import { Pagination } from './pagination'
import { nftListQuery } from './queries'
import { type CatalogSearch, catalogSearchSchema, SORT_LABEL, TAB_LABEL, toListParams } from './search'

const route = getRouteApi('/')

const SEARCH_DEBOUNCE_MS = 350

function useCatalogNavigation() {
  const navigate = route.useNavigate()
  /** Any filter change resets pagination; typing replaces history instead of pushing. */
  return (patch: Partial<CatalogSearch>, options: { replace?: boolean; keepPage?: boolean } = {}) =>
    navigate({
      search: (prev) => {
        const next = { ...prev, ...patch }
        if (!options.keepPage) delete next.page
        for (const key of Object.keys(next) as Array<keyof CatalogSearch>) {
          const value = next[key]
          if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key]
        }
        return next
      },
      replace: options.replace,
      resetScroll: false,
      hash: 'catalogo',
    })
}

function SearchBox({
  id,
  value,
  onSearch,
  className,
}: {
  id: string
  value: string
  onSearch: (q: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  // Follow external changes (history navigation) without clobbering typing.
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    setDraft(value)
  }
  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  })
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onSearchRef.current(draft), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, value])

  return (
    <div role="search" className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        Buscar NFTs por nome, coleção ou token
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-tan" aria-hidden />
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Explorar coleções"
        autoComplete="off"
        className="h-11 w-full rounded-lg bg-card pr-10 pl-11 text-[15px] text-cream placeholder:text-tan focus-visible:outline-2 focus-visible:outline-apricot md:h-10 md:rounded-sm md:border md:border-border-strong md:bg-transparent"
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft('')}
          className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-tan hover:text-cream"
          aria-label="Limpar busca"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

function ActiveFilters({ search, onChange }: { search: CatalogSearch; onChange: ReturnType<typeof useCatalogNavigation> }) {
  const chips = [
    ...(search.q ? [{ key: 'q', label: `“${search.q}”`, clear: () => onChange({ q: undefined }) }] : []),
    ...(search.categories ?? []).map((c) => ({
      key: c,
      label: CATEGORY_LABEL[c],
      clear: () => onChange({ categories: search.categories?.filter((x) => x !== c) }),
    })),
    ...(search.networks ?? []).map((n) => ({
      key: n,
      label: NETWORK_LABEL[n],
      clear: () => onChange({ networks: search.networks?.filter((x) => x !== n) }),
    })),
    ...(search.minPrice || search.maxPrice
      ? [
          {
            key: 'price',
            label: `${search.minPrice ?? '0'} – ${search.maxPrice ?? '∞'} ETH`,
            clear: () => onChange({ minPrice: undefined, maxPrice: undefined }),
          },
        ]
      : []),
  ]
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-sand">Filtros:</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="inline-flex items-center gap-1 rounded-full border border-copper px-3 py-1 text-sm text-apricot hover:bg-copper/10"
          aria-label={`Remover filtro ${chip.label}`}
        >
          {chip.label}
          <X className="size-3.5" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({ q: undefined, categories: undefined, networks: undefined, minPrice: undefined, maxPrice: undefined })
        }
        className="text-sm text-apricot underline-offset-4 hover:underline"
      >
        Limpar filtros
      </button>
    </div>
  )
}

export function CatalogSection({ mobileIntro }: { mobileIntro?: React.ReactNode }) {
  // Non-strict so the catalog can also render (inert) behind the auth modal.
  const search = catalogSearchSchema.parse(useSearch({ strict: false }))
  const update = useCatalogNavigation()
  const params = toListParams(search)
  const query = useQuery(nftListQuery(params))
  const { data, isPending, isError, error, isPlaceholderData, isFetching, refetch } = query
  const page = params.page ?? 1
  const tab = search.tab ?? 'todos'
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filters = (
    <CatalogFilters facets={data?.facets} search={search} onChange={(patch) => update(patch)} />
  )

  return (
    <section id="catalogo" aria-labelledby="catalogo-titulo" className="scroll-mt-6">
      {/* Mobile: search + filters drawer, as in the mobile frame. */}
      <div className="mb-6 flex gap-3 md:hidden">
        <SearchBox
          id="busca-catalogo-mobile"
          value={search.q ?? ''}
          onSearch={(q) => update({ q }, { replace: Boolean(search.q) && Boolean(q) })}
          className="flex-1"
        />
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="default" size="icon" className="size-11 rounded-lg" aria-label="Abrir filtros">
              <SlidersHorizontal className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-[30px] border-0 p-0">
            <SheetHeader className="px-5 pt-5">
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Os resultados são atualizados a cada alteração.</SheetDescription>
            </SheetHeader>
            <div className="px-3 pb-6">{filters}</div>
          </SheetContent>
        </Sheet>
      </div>

      {mobileIntro && <div className="md:hidden">{mobileIntro}</div>}
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>

      <div className="grid gap-8 lg:grid-cols-[310px_1fr] lg:gap-12">
        <aside aria-label="Filtros do catálogo" className="hidden flex-col gap-10 lg:flex">
          {filters}
          <FeaturedOffer />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <SearchBox
            id="busca-catalogo"
            value={search.q ?? ''}
            onSearch={(q) => update({ q }, { replace: Boolean(search.q) && Boolean(q) })}
            className="hidden md:block"
          />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div role="group" aria-label="Seleção do catálogo" className="-mx-1 flex gap-4 overflow-x-auto px-1 md:gap-6">
              {NFT_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  onClick={() => update({ tab: t === 'todos' ? undefined : t })}
                  className={cn(
                    'shrink-0 border-b-2 border-transparent pb-1 text-[15px] whitespace-nowrap text-cream hover:text-apricot',
                    tab === t && 'border-copper font-bold text-apricot',
                  )}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="ordenar" className="shrink-0 text-[15px]">
                Ordenar por:
              </label>
              <Select value={search.sort ?? 'recentes'} onValueChange={(v) => {
                  // Radix may emit '' while remounting its content; only react to real options.
                  if (!(NFT_SORTS as readonly string[]).includes(v) || v === (search.sort ?? 'recentes')) return
                  update({ sort: v === 'recentes' ? undefined : (v as CatalogSearch['sort']) })
                }}>
                <SelectTrigger id="ordenar" className="h-10 w-auto min-w-0 border-0 px-1 text-[15px] md:min-w-56 md:border md:px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  {NFT_SORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SORT_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ActiveFilters search={search} onChange={update} />

          <p className="sr-only" aria-live="polite" aria-atomic>
            {isPending ? 'Carregando NFTs' : data ? `${data.total} NFTs encontrados, página ${page} de ${Math.max(1, data.totalPages)}` : ''}
          </p>

          <div id="catalogo-grade" aria-busy={isFetching}>
            {isPending ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-10" aria-label="Carregando NFTs">
                {Array.from({ length: 9 }, (_, i) => (
                  <li key={i}>
                    <NftCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : isError && !data ? (
              <ErrorState title="Não foi possível carregar o catálogo" error={error} onRetry={() => void refetch()} retrying={isFetching} />
            ) : data && data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                description="Tente outros termos de busca ou remova alguns filtros."
                action={
                  <Button variant="outline" onClick={() => update({ q: undefined, categories: undefined, networks: undefined, minPrice: undefined, maxPrice: undefined, tab: undefined })}>
                    Limpar busca e filtros
                  </Button>
                }
              />
            ) : (
              <>
                {isError && (
                  <p role="alert" className="mb-4 rounded-sm border border-copper bg-card px-4 py-2 text-sm">
                    Não foi possível atualizar os resultados. Exibindo a última lista carregada.{' '}
                    <button type="button" className="text-apricot underline" onClick={() => void refetch()}>
                      Tentar novamente
                    </button>
                  </p>
                )}
                <ul
                  className={cn(
                    'grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity md:grid-cols-3 md:gap-x-6 md:gap-y-10',
                    isPlaceholderData && 'opacity-60',
                  )}
                >
                  {data?.items.map((nft, i) => (
                    <li key={nft.id} className={cn(i % 2 === 1 && 'max-md:mt-8')}>
                      <NftCard nft={nft} priority={i < 3} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {data && (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              onChange={(p) => update({ page: p === 1 ? undefined : p }, { keepPage: true })}
            />
          )}
        </div>
      </div>
    </section>
  )
}
