import { Link } from '@tanstack/react-router'
import { NftImage } from '@/components/nft-image'

/** "NFT em destaque" card under the desktop filters. */
export function FeaturedOffer() {
  return (
    <Link
      to="/nft/$nftId"
      params={{ nftId: 'cosmic-bloom-118' }}
      className="group flex flex-col gap-3 rounded-sm bg-card pt-5 hover:ring-1 hover:ring-copper"
    >
      <span className="px-3 text-xl font-bold tracking-wide text-apricot">NFT EM DESTAQUE</span>
      <span className="self-center text-lg font-bold">OFERTA LIMITADA</span>
      <NftImage
        image="nomad-bucket-hat"
        alt="Cosmic Bloom #118: gorila cinza com chapéu bucket verde e moletom roxo"
        sizes="310px"
        className="rounded-xl"
      />
    </Link>
  )
}
