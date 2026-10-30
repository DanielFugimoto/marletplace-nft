import { createFileRoute } from '@tanstack/react-router'
import { nftDetailQuery } from '@/features/catalog/queries'
import { NftDetailPage } from '@/features/nft/nft-detail-page'

export const Route = createFileRoute('/nft/$nftId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
  },
  staticData: { hideMobileTabBar: true, hideMobileFooter: true },
  component: NftRoute,
})

function NftRoute() {
  const { nftId } = Route.useParams()
  return <NftDetailPage key={nftId} nftId={nftId} />
}
