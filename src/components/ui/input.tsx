import type * as React from 'react'
import { cn } from '@/lib/utils'

export const inputClasses =
  'h-10 w-full min-w-0 rounded-sm border border-border-strong bg-transparent px-3 text-sm text-cream transition-colors outline-none placeholder:text-tan selection:bg-primary selection:text-primary-foreground hover:border-border-soft focus-visible:border-apricot focus-visible:ring-1 focus-visible:ring-apricot disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClasses, className)} {...props} />
}

export { Input }
