import { Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { inputClasses } from './ui/input'

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: string
  required?: boolean
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode
}

/** Label + control + error wiring (aria-invalid / aria-describedby) in one place. */
export function Field({ label, error, hint, required, hideLabel, className, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-erro`
  const hintId = `${id}-dica`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-[15px]', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="ml-0.5 text-coral" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-tan">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={cn(inputClasses, 'pr-11', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-tan hover:text-cream"
      >
        {visible ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
      </button>
    </div>
  )
}

/** Error summary announced on submit failures that aren't tied to a field. */
export function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-cream">
      {message}
    </p>
  )
}
