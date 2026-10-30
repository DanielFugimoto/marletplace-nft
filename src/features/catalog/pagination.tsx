import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function pageWindow(page: number, total: number) {
  const start = Math.max(1, Math.min(page - 1, total - 3))
  return Array.from({ length: Math.min(4, total) }, (_, i) => start + i)
}

const item =
  'inline-flex size-8 items-center justify-center rounded-sm border border-border-soft text-sm text-cream hover:border-copper disabled:pointer-events-none disabled:opacity-40'

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex items-center gap-2">
        <li>
          <button type="button" className={item} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </li>
        {pageWindow(page, totalPages).map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              className={cn(item, p === page && 'border-copper bg-copper font-bold text-ink')}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={item}
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}
