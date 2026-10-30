import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** "− n +" control from the layout. Keyboard: buttons + the live value is announced. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const btn = cn(
    'inline-flex items-center justify-center rounded-full bg-copper text-ink transition-colors hover:bg-copper-dark disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-tan',
    size === 'md' ? 'h-10 w-[30px]' : 'size-6',
  )
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center gap-3', className)}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir ${label.toLowerCase()}`}
      >
        <Minus className={size === 'md' ? 'size-5' : 'size-3.5'} aria-hidden />
      </button>
      <output aria-live="polite" className={cn('min-w-6 text-center tabular-nums', size === 'md' ? 'text-xl' : 'text-base')}>
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar ${label.toLowerCase()}`}
      >
        <Plus className={size === 'md' ? 'size-5' : 'size-3.5'} aria-hidden />
      </button>
    </div>
  )
}
