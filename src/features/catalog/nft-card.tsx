import { Link } from '@tanstack/react-router'
import { Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { NftImage } from '@/components/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCartAction } from '@/features/cart/use-add-to-cart'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export function Price({ price, compareAt, className }: { price: string; compareAt?: string | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-apricot', className)}>
      <span>{formatEth(price)}</span>
      {compareAt && (
        <span className="text-base font-normal text-tan line-through">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAt)}
        </span>
      )}
    </p>
  )
}

export function NftCard({ nft, priority, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const { addItem, isPending } = useAddToCartAction()
  return (
    <article className={cn('group relative flex flex-col gap-3', className)} aria-labelledby={`nft-${nft.id}`}>
      <div className="relative rounded-sm bg-card p-3 md:p-4">
        {nft.rarity === 'raro' && (
          <span className="absolute top-0 left-0 z-10 rounded-tl-sm bg-copper px-3 py-1 text-sm font-medium text-ink">
            RARO
          </span>
        )}
        <NftImage image={nft.image} alt={nft.imageAlt} priority={priority} className="rounded-xl" />
        {nft.soldOut && (
          <span className="absolute right-4 bottom-4 rounded-sm bg-ink/90 px-2 py-1 text-xs font-bold text-cream">
            ESGOTADO
          </span>
        )}
        {/* Quick actions: visible on hover/focus on desktop, always on touch. */}
        <div className="absolute top-5 right-5 z-10 flex gap-2 opacity-100 transition-opacity md:top-auto md:right-auto md:bottom-1 md:left-1/2 md:-translate-x-1/2 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            disabled={nft.soldOut || isPending}
            onClick={() =>
              void addItem({ nftId: nft.id, name: nft.name, editionId: nft.defaultEditionId, editionLabel: '1/50', quantity: 1 }).catch(
                () => undefined,
              )
            }
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            title="Adicionar ao carrinho"
            className="hidden size-9 items-center justify-center rounded-sm bg-surface-card/90 text-cream hover:text-apricot disabled:opacity-50 md:inline-flex"
          >
            <ShoppingCart className="size-5" aria-hidden />
          </button>
          <FavoriteButton nftId={nft.id} name={nft.name} />
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            aria-label={`Ver detalhes de ${nft.name}`}
            className="hidden size-9 items-center justify-center rounded-sm bg-surface-card/90 text-cream hover:text-apricot md:inline-flex"
          >
            <Search className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 id={`nft-${nft.id}`} className="text-[15px] leading-tight">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="after:absolute after:inset-0 hover:text-apricot focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-apricot"
          >
            {nft.name}
          </Link>
        </h3>
        <Price price={nft.price} compareAt={nft.compareAtPrice} />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-sm bg-card p-3 md:p-4">
        <Skeleton className="aspect-square w-full rounded-xl" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  )
}
