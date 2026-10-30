import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { credentials } from '@/api/credentials'
import { sessionQuery } from '@/features/auth/session'

/** Pathless layout guarding every private screen (checkout, profile, wallets, orders). */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    const token = credentials.getSession()?.token ?? null
    const session = token ? await context.queryClient.ensureQueryData(sessionQuery(token)) : null
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { user: session.user }
  },
  component: Outlet,
})
