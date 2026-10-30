import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/auth-screens'
import { authSearchSchema, redirectIfAuthenticated } from '@/features/auth/auth-search'

export const Route = createFileRoute('/cadastro')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  staticData: { hideMobileTabBar: true, hideMobileFooter: true },
  component: RegisterRoute,
})

function RegisterRoute() {
  return <AuthScreen mode="register" search={Route.useSearch()} />
}
