import { Link } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, UserRound } from 'lucide-react'
import { useCart } from '@/features/cart/queries'
import { notifyUnavailable } from '@/lib/unavailable'

const tab =
  'flex size-12 items-center justify-center rounded-full text-tan transition-colors hover:text-cream data-[status=active]:text-apricot'

/** Bottom navigation from the mobile frames (hidden from md up). */
export function MobileTabBar() {
  const { data: cart } = useCart()
  const count = cart?.itemCount ?? 0
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 h-[76px] rounded-t-[30px] bg-card shadow-sheet md:hidden"
    >
      <ul className="mx-auto grid h-full max-w-md grid-cols-5 items-center px-4">
        <li className="flex justify-center">
          <Link to="/" className={tab} aria-label="Início" activeOptions={{ exact: true, includeHash: false }}>
            <House className="size-6" aria-hidden />
          </Link>
        </li>
        <li className="flex justify-center">
          <Link to="/favoritos" className={tab} aria-label="Favoritos">
            <Heart className="size-6" aria-hidden />
          </Link>
        </li>
        <li className="flex justify-center">
          <button
            type="button"
            onClick={() => notifyUnavailable('A leitura de QR code')}
            aria-label="Escanear QR code"
            className="-mt-12 flex size-16 items-center justify-center rounded-full bg-copper text-ink shadow-card ring-8 ring-ink hover:bg-copper-dark"
          >
            <ScanLine className="size-7" aria-hidden />
          </button>
        </li>
        <li className="flex justify-center">
          <Link
            to="/carrinho"
            className={`${tab} relative`}
            aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
          >
            <ShoppingCart className="size-6" aria-hidden />
            {count > 0 && (
              <span aria-hidden className="absolute top-1.5 right-1 min-w-4 rounded-full bg-copper px-1 text-[10px] leading-4 text-ink">
                {count}
              </span>
            )}
          </Link>
        </li>
        <li className="flex justify-center">
          <Link to="/perfil" className={tab} aria-label="Meu perfil">
            <UserRound className="size-6" aria-hidden />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
