import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { setSessionExpiredHandler } from './api/http'
import { endSession } from './features/auth/session'
import { createQueryClient } from './lib/query-client'
import { createAppRouter } from './router'

export function mountApp(container: HTMLElement) {
  const queryClient = createQueryClient()
  const router = createAppRouter(queryClient)

  // Any authenticated request answered with 401 ends the session once and sends
  // the collector to login, remembering where they were to resume afterwards.
  let handlingExpiry = false
  setSessionExpiredHandler((error) => {
    if (handlingExpiry) return
    handlingExpiry = true
    endSession(queryClient)
    const { pathname, href } = router.state.location
    toast.warning(error.code === 'SESSION_EXPIRED' ? 'Sua sessão expirou' : 'Sessão encerrada', {
      id: 'session-expired',
      description: 'Entre novamente para continuar de onde parou.',
    })
    const redirect = pathname.startsWith('/login') || pathname.startsWith('/cadastro') ? undefined : href
    void router.navigate({ to: '/login', search: { redirect, reason: 'expired' } }).finally(() => {
      handlingExpiry = false
    })
  })

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
