import { AlertTriangle, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { isApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  if (isApiError(error)) return error.message
  return fallback
}

export function ErrorState({
  title = 'Não foi possível carregar',
  error,
  onRetry,
  retrying,
  className,
}: {
  title?: string
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-sm bg-card px-6 py-10 text-center', className)}>
      <AlertTriangle className="size-8 text-apricot" aria-hidden />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-md text-sm text-sand">{errorMessage(error)}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} aria-busy={retrying}>
          {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-sm bg-card px-6 py-10 text-center', className)}>
      {icon ?? <SearchX className="size-8 text-apricot" aria-hidden />}
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="max-w-md text-sm text-sand">{description}</p>}
      {action}
    </div>
  )
}
