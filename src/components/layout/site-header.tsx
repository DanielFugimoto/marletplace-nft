import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart, UserRound } from 'lucide-react'
import { useCart } from '@/features/cart/queries'
import { useSession } from '@/features/auth/session'
import { notifyUnavailable } from '@/lib/unavailable'
import { cn } from '@/lib/utils'

const navLink =
  'relative inline-flex h-full items-center px-1 text-[15px] text-cream transition-colors hover:text-apricot after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-copper after:opacity-0 after:transition-opacity data-[active=true]:font-bold data-[active=true]:text-apricot data-[active=true]:after:opacity-100'

const MARKET_PATHS = ['/nft', '/carrinho', '/pagamento', '/pedido']

export function CartButton({ className }: { className?: string }) {
  const { data: cart } = useCart()
  const count = cart?.itemCount ?? 0
  return (
    <Link
      to="/carrinho"
      className={cn('relative inline-flex size-10 items-center justify-center rounded-sm hover:bg-surface-raised', className)}
      aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
    >
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-copper px-1 text-[10px] leading-4 font-medium text-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export function SiteHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, isPending } = useSession()
  const isHome = pathname === '/'
  const isMarket = MARKET_PATHS.some((p) => pathname.startsWith(p))

  const focusSearch = async () => {
    if (!isHome) await navigate({ to: '/' })
    requestAnimationFrame(() => {
      const input = document.getElementById('busca-catalogo') as HTMLInputElement | null
      input?.scrollIntoView({ block: 'center' })
      input?.focus()
    })
  }

  return (
    <header className="hidden md:block">
      <div className="mx-auto flex h-[68px] max-w-page items-center justify-between border-b border-border-soft px-6 xl:px-0">
        <Link to="/" className="text-sm font-bold tracking-[0.1em] text-cream" aria-label="Kurio, página inicial">
          KURIO
        </Link>

        <nav aria-label="Principal" className="flex h-full items-center gap-9">
          <Link to="/" className={navLink} data-active={isHome} aria-current={isHome ? 'page' : undefined}>
            Início
          </Link>
          <Link to="/" hash="catalogo" className={navLink} data-active={isMarket} aria-current={isMarket ? 'page' : undefined}>
            Mercado
          </Link>
          <button type="button" className={navLink} onClick={() => notifyUnavailable('A página Criadores')}>
            Criadores
          </button>
          <button type="button" className={navLink} onClick={() => notifyUnavailable('A página Aprenda')}>
            Aprenda
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={focusSearch}
            className="inline-flex size-10 items-center justify-center rounded-sm hover:bg-surface-raised"
            aria-label="Buscar NFTs"
          >
            <Search className="size-6" aria-hidden />
          </button>
          <CartButton />
          {user ? (
            <Link
              to="/perfil"
              className="ml-2 inline-flex h-[34px] max-w-48 items-center gap-2 rounded-sm border border-copper px-2.5 text-[15px] text-apricot hover:bg-copper/10"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <UserRound className="size-5" aria-hidden />
              )}
              <span className="truncate">{user.displayName}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ redirect: pathname === '/login' ? undefined : pathname }}
              className={cn(
                'ml-2 inline-flex h-[34px] items-center gap-1.5 rounded-sm bg-copper px-2.5 text-base text-ink hover:bg-copper-dark',
                isPending && 'opacity-60',
              )}
            >
              <LogIn className="size-5" aria-hidden />
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
