import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/states'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { nftDetailQuery } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/queries'

export const Route = createFileRoute('/_auth/favoritos')({
  component: FavoritesPage,
})

function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const details = useQueries({ queries: ids.map((id) => nftDetailQuery(id)) })

  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 pt-6 pb-28 md:px-6 md:pt-8 md:pb-8 xl:px-0">
      <h1 className="text-2xl font-bold">Lista de interesse</h1>
      {favorites.isPending ? (
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favorites.isError ? (
        <ErrorState title="Não foi possível carregar seus favoritos" error={favorites.error} onRetry={() => void favorites.refetch()} />
      ) : ids.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-8 text-apricot" aria-hidden />}
          title="Nenhum favorito ainda"
          description="Toque no coração de um NFT para guardá-lo aqui."
          action={
            <Link to="/" hash="catalogo" className="font-bold text-apricot hover:underline">
              Explorar NFTs
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {details.map((q, i) => (
            <li key={ids[i]}>{q.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
