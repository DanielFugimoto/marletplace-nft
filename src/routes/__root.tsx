import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useMatches } from '@tanstack/react-router'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Toaster } from '@/components/ui/sonner'
import { RealtimeAnnouncer } from '@/realtime/RealtimeAnnouncer'
import { RealtimeBridge } from '@/realtime/RealtimeBridge'

export interface RouterContext {
  queryClient: QueryClient
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Mobile frames with their own bottom action bar hide the tab bar. */
    hideMobileTabBar?: boolean
    hideFooter?: boolean
    /** Mobile frames with a fixed action sheet don't show the footer. */
    hideMobileFooter?: boolean
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const matches = useMatches()
  const hideTabBar = matches.some((m) => m.staticData?.hideMobileTabBar)
  const hideFooter = matches.some((m) => m.staticData?.hideFooter)
  const hideMobileFooter = matches.some((m) => m.staticData?.hideMobileFooter)
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" tabIndex={-1} className="min-h-dvh outline-none">
        <Outlet />
      </main>
      {!hideFooter && <SiteFooter className={hideMobileFooter ? 'max-md:hidden' : undefined} />}
      {!hideTabBar && <MobileTabBar />}
      <Toaster position="top-center" closeButton />
      <RealtimeBridge />
      <RealtimeAnnouncer />
    </>
  )
}

function NotFound() {
  return (
    <section className="mx-auto flex max-w-page flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-sand">O endereço acessado não existe ou foi removido.</p>
      <Link to="/" className="font-bold text-apricot underline-offset-4 hover:underline">
        Voltar para o início
      </Link>
    </section>
  )
}
