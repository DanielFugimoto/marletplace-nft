import { useId, useState } from 'react'
import {
  type Category,
  CATEGORY_LABEL,
  NETWORK_LABEL,
  type Network,
  type NftListResponse,
} from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { CatalogSearch } from './search'

type Facets = NftListResponse['facets']

const toggle = <T,>(list: T[] | undefined, value: T) =>
  list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]

const formatBr = (n: number) => n.toFixed(2).replace('.', ',')

function FacetList<T extends string>({
  title,
  options,
  selected,
  labels,
  onToggle,
}: {
  title: string
  options: Array<{ value: T; count: number }>
  selected: T[] | undefined
  labels: Record<T, string>
  onToggle: (value: T) => void
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3 id={headingId} className="mb-2 text-lg font-bold">
        {title}
      </h3>
      <ul className="flex flex-col">
        {options.map(({ value, count }) => {
          const active = selected?.includes(value) ?? false
          return (
            <li key={value}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(value)}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-[15px] text-sand transition-colors hover:bg-surface-raised hover:text-cream',
                  active && 'bg-surface-raised font-bold text-apricot',
                )}
              >
                <span className="flex items-center gap-2">
                  {/* A visible marker besides color for the selected state. */}
                  <span
                    aria-hidden
                    className={cn('size-2 rounded-full border border-copper', active ? 'bg-copper' : 'bg-transparent')}
                  />
                  {labels[value]}
                </span>
                <span className="tabular-nums">({count})</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PriceFilter({
  facets,
  search,
  onApply,
}: {
  facets: Facets
  search: CatalogSearch
  onApply: (range: { minPrice?: string; maxPrice?: string }) => void
}) {
  const floor = Math.floor(Number(facets.priceRange.min) * 100) / 100
  const ceil = Math.ceil(Number(facets.priceRange.max) * 100) / 100
  const current: [number, number] = [
    search.minPrice ? Number(search.minPrice) : floor,
    search.maxPrice ? Number(search.maxPrice) : ceil,
  ]
  const [range, setRange] = useState<[number, number]>(current)

  const headingId = useId()
  const dirty = range[0] !== current[0] || range[1] !== current[1]
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-bold">
        Faixa de preço
      </h3>
      <Slider
        min={floor}
        max={ceil}
        step={0.01}
        minStepsBetweenThumbs={1}
        value={range}
        onValueChange={(v) => setRange([v[0]!, v[1]!])}
        thumbLabels={['Preço mínimo em ETH', 'Preço máximo em ETH']}
        className="px-1 py-2"
      />
      <p className="text-[15px]" aria-live="polite">
        Preço: {formatBr(range[0])} - {formatBr(range[1])} ETH
      </p>
      <Button
        size="sm"
        className="w-fit"
        disabled={!dirty}
        onClick={() =>
          onApply({
            minPrice: range[0] > floor ? range[0].toFixed(2) : undefined,
            maxPrice: range[1] < ceil ? range[1].toFixed(2) : undefined,
          })
        }
      >
        Aplicar
      </Button>
    </section>
  )
}

export function CatalogFilters({
  facets,
  search,
  onChange,
  className,
}: {
  facets: Facets | undefined
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>) => void
  className?: string
}) {
  if (!facets) {
    return (
      <div className={cn('flex flex-col gap-3 rounded-sm bg-card p-5', className)} aria-hidden>
        <Skeleton className="h-6 w-28" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
        <Skeleton className="mt-4 h-6 w-36" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col gap-8 rounded-sm bg-card p-5', className)}>
      <FacetList<Category>
        title="Coleções"
        options={facets.categories}
        selected={search.categories}
        labels={CATEGORY_LABEL}
        onToggle={(value) => onChange({ categories: toggle(search.categories, value) })}
      />
      {/* Keyed by the URL range so history navigation / clearing re-syncs the slider. */}
      <PriceFilter
        key={`${search.minPrice}-${search.maxPrice}-${facets.priceRange.min}-${facets.priceRange.max}`}
        facets={facets}
        search={search}
        onApply={onChange}
      />
      <FacetList<Network>
        title="Rede"
        options={facets.networks}
        selected={search.networks}
        labels={NETWORK_LABEL}
        onToggle={(value) => onChange({ networks: toggle(search.networks, value) })}
      />
    </div>
  )
}
