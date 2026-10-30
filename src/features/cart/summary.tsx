import type { Quote } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Subtotal / discount / fee / total exactly as returned by the quote API. */
export function QuoteSummary({ quote, isPending, className }: { quote: Quote | undefined; isPending: boolean; className?: string }) {
  if (isPending || !quote) {
    return (
      <div className={cn('flex flex-col gap-4', className)} aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
        <div className="mt-4 flex justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    )
  }
  const hasDiscount = Number(quote.discount) > 0
  return (
    <dl className={cn('flex flex-col gap-3 text-[15px]', className)} aria-live="polite" aria-atomic>
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg tabular-nums">{formatEth(quote.subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>
          Desconto do lançamento
          {quote.coupon?.status === 'applied' && <span className="block text-xs text-sand">{quote.coupon.code}</span>}
        </dt>
        <dd className={cn('tabular-nums', hasDiscount && 'text-success')}>(-) {formatEth(quote.discount, { suffix: hasDiscount })}</dd>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd className="text-lg tabular-nums">{formatEth(quote.networkFee)}</dd>
        </div>
        <p className="self-end text-xs text-apricot">Taxa estimada</p>
      </div>
      <div className="mt-4 flex justify-between border-t border-border-soft pt-4 text-lg font-bold">
        <dt>Total</dt>
        <dd className="text-apricot tabular-nums">{formatEth(quote.total)}</dd>
      </div>
    </dl>
  )
}
