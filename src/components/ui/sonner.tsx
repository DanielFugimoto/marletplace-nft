import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import type * as React from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Sonner renders an aria-live region, so toasts double as accessible feedback. */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    className="toaster group"
    containerAriaLabel="Notificações"
    icons={{
      success: <CircleCheckIcon className="size-4 text-success" aria-hidden />,
      info: <InfoIcon className="size-4 text-apricot" aria-hidden />,
      warning: <TriangleAlertIcon className="size-4 text-apricot" aria-hidden />,
      error: <OctagonXIcon className="size-4 text-destructive" aria-hidden />,
      loading: <Loader2Icon className="size-4 animate-spin" aria-hidden />,
    }}
    toastOptions={{ classNames: { toast: 'font-sans', description: '!text-sand' } }}
    style={
      {
        '--normal-bg': 'var(--surface-card)',
        '--normal-text': 'var(--cream)',
        '--normal-border': 'var(--border-soft)',
        '--border-radius': 'var(--radius)',
      } as React.CSSProperties
    }
    {...props}
  />
)

export { Toaster }
