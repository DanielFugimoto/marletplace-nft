import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { CircleAlert, Download, Heart, LogOut, MapPin, ShoppingCart, Sparkles, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useLogout } from '@/features/auth/mutations'
import { notifyUnavailable } from '@/lib/unavailable'

const item =
  'relative flex h-11 shrink-0 items-center gap-3 rounded-sm px-4 text-[15px] whitespace-nowrap text-apricot transition-colors hover:bg-surface-raised data-[status=active]:bg-surface-raised data-[status=active]:font-bold md:data-[status=active]:before:absolute md:data-[status=active]:before:inset-y-0 md:data-[status=active]:before:left-0 md:data-[status=active]:before:w-1.5 md:data-[status=active]:before:bg-copper'

export function AccountLayout() {
  const logout = useLogout()
  const navigate = useNavigate()

  const onLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success('Você saiu da sua conta', { id: 'auth' })
        void navigate({ to: '/', replace: true })
      },
    })

  return (
    <div className="mx-auto grid max-w-page grid-cols-1 gap-6 px-4 pt-6 pb-28 md:grid-cols-[310px_1fr] md:gap-7 md:px-6 md:pt-8 md:pb-8 xl:px-0">
      <nav aria-labelledby="meu-perfil" className="h-fit min-w-0 rounded-sm bg-card md:py-4">
        <h2 id="meu-perfil" className="px-3 pt-3 text-lg font-bold md:pt-0 md:pb-2">
          Meu perfil
        </h2>
        <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-0">
          <li>
            <Link to="/perfil" activeOptions={{ exact: true }} className={item}>
              <UserRound className="size-5" aria-hidden /> Dados do perfil
            </Link>
          </li>
          <li>
            <Link to="/perfil/carteiras" className={item}>
              <MapPin className="size-5" aria-hidden /> Carteiras
            </Link>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notifyUnavailable('O histórico de atividade')}>
              <ShoppingCart className="size-5" aria-hidden /> Atividade
            </button>
          </li>
          <li>
            <Link to="/favoritos" className={item}>
              <Heart className="size-5" aria-hidden /> Lista de interesse
            </Link>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notifyUnavailable('A página de ofertas')}>
              <Sparkles className="size-5" aria-hidden /> Ofertas
            </button>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notifyUnavailable('A página de arquivos baixados')}>
              <Download className="size-5" aria-hidden /> Arquivos baixados
            </button>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notifyUnavailable('O suporte')}>
              <CircleAlert className="size-5" aria-hidden /> Suporte
            </button>
          </li>
          <li className="md:mt-1 md:border-t md:border-border-soft md:pt-1">
            <button type="button" className={`${item} font-bold`} onClick={onLogout} disabled={logout.isPending}>
              <LogOut className="size-5" aria-hidden /> {logout.isPending ? 'Saindo…' : 'Sair'}
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
