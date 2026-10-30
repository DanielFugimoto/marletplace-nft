import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'rounded-sm bg-primary text-primary-foreground hover:bg-copper-dark',
        /** Mobile CTAs use a soft copper gradient pill. */
        pill: 'rounded-2xl bg-[linear-gradient(90deg,var(--copper)_0%,color-mix(in_oklab,var(--copper)_80%,var(--ink))_100%)] text-primary-foreground hover:brightness-110',
        outline: 'rounded-sm border border-primary bg-transparent text-apricot hover:bg-primary/10',
        secondary: 'rounded-sm bg-surface-raised text-cream hover:bg-border-soft',
        ghost: 'rounded-sm text-cream hover:bg-surface-raised',
        destructive: 'rounded-sm bg-destructive text-ink hover:brightness-110',
        link: 'h-auto p-0 font-normal text-apricot underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
