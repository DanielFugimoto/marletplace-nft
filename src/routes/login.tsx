import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/auth-screens'
import { authSearchSchema, redirectIfAuthenticated } from '@/features/auth/auth-search'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  staticData: { hideMobileTabBar: true, hideMobileFooter: true },
  component: LoginRoute,
})

function LoginRoute() {
  return <AuthScreen mode="login" search={Route.useSearch()} />
}
