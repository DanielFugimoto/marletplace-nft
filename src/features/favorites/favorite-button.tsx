import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage } from '@/components/states'
import { useSession } from '@/features/auth/session'
import { cn } from '@/lib/utils'
import { useFavorites, useToggleFavorite } from './queries'

export function useFavoriteAction(nftId: string, name: string) {
  const { user } = useSession()
  const { isFavorite } = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const { href } = useLocation()
  const active = isFavorite(nftId)

  const onToggle = () => {
    if (!user) {
      toast.info('Entre para salvar favoritos', { id: 'favorite-login' })
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    const favorite = !active
    toggle.mutate(
      { nftId, favorite },
      {
        onSuccess: () =>
          toast.success(favorite ? `${name} adicionado aos favoritos` : `${name} removido dos favoritos`, {
            id: `favorite-${nftId}`,
          }),
        onError: (error) =>
          toast.error('Não foi possível atualizar seus favoritos', {
            id: `favorite-${nftId}`,
            description: `${errorMessage(error)} O estado anterior foi restaurado.`,
          }),
      },
    )
  }
  return { active, onToggle, pending: toggle.isPending }
}

export function FavoriteButton({
  nftId,
  name,
  variant = 'icon',
  className,
}: {
  nftId: string
  name: string
  variant?: 'icon' | 'labeled'
  className?: string
}) {
  const { active, onToggle } = useFavoriteAction(nftId, name)
  const label = active ? `Remover ${name} dos favoritos` : `Adicionar ${name} aos favoritos`

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-sm border border-copper px-3 text-[15px] text-apricot hover:bg-copper/10',
          className,
        )}
      >
        <Heart className={cn('size-5', active && 'fill-copper')} aria-hidden />
        {active ? 'Favoritado' : 'Favoritar'}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-sm bg-surface-card/90 text-cream hover:text-apricot',
        className,
      )}
    >
      <Heart className={cn('size-5', active && 'fill-copper text-copper')} aria-hidden />
    </button>
  )
}
