import { X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { toast } from 'sonner'
import type { Quote } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { errorMessage } from '@/components/states'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from './queries'

export function CouponForm({ coupon, variant = 'desktop' }: { coupon: Quote['coupon'] | undefined; variant?: 'desktop' | 'mobile' }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim()) {
      setError('Informe o código promocional')
      return
    }
    setError(null)
    apply.mutate(code.trim(), {
      onSuccess: () => {
        toast.success('Código promocional aplicado', { id: 'coupon' })
        setCode('')
      },
      onError: (e) => setError(isApiError(e) ? (e.fieldErrors.code ?? e.message) : errorMessage(e)),
    })
  }

  if (coupon?.status === 'applied') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-copper px-3 py-2">
        <p className="text-sm">
          <span className="font-bold text-apricot">{coupon.code}</span>
          <span className="block text-sand">{coupon.description}</span>
        </p>
        <button
          type="button"
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => toast.info('Código promocional removido', { id: 'coupon' }),
              onError: (e) => toast.error('Não foi possível remover o código', { description: errorMessage(e) }),
            })
          }
          disabled={remove.isPending}
          className="inline-flex items-center gap-1 text-sm text-apricot hover:underline"
        >
          <X className="size-4" aria-hidden /> Remover
        </button>
      </div>
    )
  }

  const mobile = variant === 'mobile'
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className={cn('text-sm font-bold', mobile && 'sr-only')}>
        Código promocional
      </label>
      <div className={cn('flex', mobile && 'rounded-full border border-border-soft')}>
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          autoCapitalize="characters"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-erro` : undefined}
          className={cn(
            'h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-cream placeholder:text-tan focus-visible:outline-2 focus-visible:outline-apricot aria-invalid:border-destructive',
            mobile ? 'h-12 rounded-l-full pl-4' : 'rounded-l-sm border border-r-0 border-copper',
          )}
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'px-5 text-base font-bold text-ink disabled:opacity-60',
            mobile ? 'rounded-full bg-[linear-gradient(90deg,var(--copper),color-mix(in_oklab,var(--copper)_70%,var(--ink)))]' : 'rounded-r-sm bg-copper hover:bg-copper-dark',
          )}
        >
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && !mobile && <p className="text-xs text-tan">Experimente KURIO10 ou GENESIS.</p>}
    </form>
  )
}
