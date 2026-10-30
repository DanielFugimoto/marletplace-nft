import { cn } from '@/lib/utils'

/**
 * Shimmer placeholder. Callers size it to match the final content so the
 * layout doesn't shift; the global reduced-motion rule stops the animation.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-card)_0%,var(--surface-raised)_40%,var(--border-soft)_50%,var(--surface-raised)_60%,var(--surface-card)_100%)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
