import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { useState } from 'react'
import type { Edition, NftDetail } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCart } from '@/features/cart/queries'
import { useAddToCartAction } from '@/features/cart/use-add-to-cart'
import { NftCard, NftCardSkeleton, Price } from '@/features/catalog/nft-card'
import { nftDetailQuery, nftListQuery } from '@/features/catalog/queries'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { QuantityStepper } from './quantity-stepper'

function Rating({ rating, count, compact }: { rating: number; count: number; compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-copper px-2 py-0.5 text-sm">
        <Star className="size-4 fill-copper text-copper" aria-hidden />
        <span className="font-bold">{rating.toFixed(1)}</span>
        <span className="text-sand">({count})</span>
        <span className="sr-only">de 5, {count} avaliações</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 text-[15px]">
      <span className="flex" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn('size-4', i < Math.round(rating) ? 'fill-cream text-cream' : 'text-tan')} />
        ))}
      </span>
      <span>
        <span className="sr-only">Nota {rating.toFixed(1)} de 5, </span>
        {count} avaliações de colecionadores
      </span>
    </span>
  )
}

function EditionPicker({
  editions,
  selected,
  onSelect,
}: {
  editions: Edition[]
  selected: Edition['id']
  onSelect: (id: Edition['id']) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[15px] font-bold">Edição:</legend>
      <div className="flex flex-wrap gap-2">
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          const active = edition.id === selected
          return (
            <label
              key={edition.id}
              className={cn(
                'relative inline-flex h-7 cursor-pointer items-center rounded-full border border-border-soft px-3 text-sm text-sand transition-colors has-focus-visible:outline-2 has-focus-visible:outline-apricot',
                active && 'border-2 border-copper font-bold text-apricot',
                soldOut && 'cursor-not-allowed line-through opacity-50',
              )}
            >
              <input
                type="radio"
                name="edition"
                value={edition.id}
                checked={active}
                disabled={soldOut}
                onChange={() => onSelect(edition.id)}
                className="sr-only"
              />
              {edition.label}
              {soldOut && <span className="sr-only"> (esgotada)</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Gallery({ nft }: { nft: NftDetail }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const current = nft.gallery[index] ?? nft.gallery[0]!
  return (
    <div className="relative flex gap-6">
      <ul className="hidden flex-col gap-4 lg:flex" aria-label="Miniaturas">
        {nft.gallery.map((item, i) => (
          <li key={item.alt}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Mostrar ${item.alt}`}
              aria-pressed={i === index}
              className={cn('block w-[89px] overflow-hidden rounded-sm ring-copper', i === index && 'ring-2')}
            >
              <NftImage image={item.src} alt="" sizes="89px" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative flex-1 rounded-sm bg-card p-5">
        <NftImage image={current.src} alt={nft.imageAlt} priority sizes="(min-width: 1024px) 400px, 100vw" className="rounded-xl" />
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="absolute top-7 right-7 inline-flex size-10 items-center justify-center rounded-full bg-ink/80 text-cream hover:text-apricot md:top-2 md:right-2"
            aria-label="Ampliar imagem"
          >
            <Search className="size-5" aria-hidden />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[min(90vw,900px)] p-3 sm:max-w-[min(90vw,900px)]">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">{current.alt}</DialogDescription>
          <NftImage image={current.src} alt={nft.imageAlt} sizes="900px" className="rounded-sm" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = typeof window === 'undefined' ? '' : window.location.href
  const text = encodeURIComponent(`${nft.name} na Kurio`)
  const link = 'inline-flex size-7 items-center justify-center rounded-sm text-cream hover:text-apricot'
  return (
    <div className="flex items-center gap-2 text-[15px] font-bold">
      Compartilhar este NFT:
      <a className={link} target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} aria-label="Compartilhar no LinkedIn (abre em nova aba)">
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
          <path d="M5 9h3v11H5zM6.5 4a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10 9h3v1.6c.6-1 1.8-1.8 3.5-1.8 3 0 3.5 2 3.5 4.6V20h-3v-5.6c0-1.3 0-2.9-1.8-2.9S13 13 13 14.3V20h-3z" />
        </svg>
      </a>
      <a className={link} href={`mailto:?subject=${text}&body=${encodeURIComponent(url)}`} aria-label="Compartilhar por e-mail">
        <Mail className="size-4" aria-hidden />
      </a>
      <a className={link} target="_blank" rel="noopener noreferrer" href={`https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}`} aria-label="Compartilhar no X (abre em nova aba)">
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
          <path d="M4 4h4.5l3.6 5 4.2-5H19l-5.6 6.6L20 20h-4.5l-3.9-5.4L7 20H4.4l6-7z" />
        </svg>
      </a>
    </div>
  )
}

function RelatedNfts({ nft }: { nft: NftDetail }) {
  const { data, isPending } = useQuery(nftListQuery({ collection: nft.collection.id, exclude: nft.id, pageSize: 5, page: 1 }))
  if (!isPending && (!data || data.items.length === 0)) return null
  return (
    <section aria-labelledby="mais-colecao" className="flex flex-col gap-6">
      <h2 id="mais-colecao" className="border-b border-border-soft pb-2 text-lg font-bold text-apricot">
        Mais desta coleção
      </h2>
      <ul className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-48 shrink-0 lg:w-auto">
                <NftCardSkeleton />
              </li>
            ))
          : data?.items.map((item) => (
              <li key={item.id} className="w-48 shrink-0 snap-start lg:w-auto">
                <NftCard nft={item} />
              </li>
            ))}
      </ul>
    </section>
  )
}

function useCartQuantity(nftId: string, editionId: string) {
  const { data } = useCart()
  return data?.items.find((i) => i.nftId === nftId && i.editionId === editionId)?.quantity ?? 0
}

function Purchase({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const firstAvailable = nft.editions.find((e) => e.id === nft.defaultEditionId && e.available > 0) ?? nft.editions.find((e) => e.available > 0)
  const [editionId, setEditionId] = useState<Edition['id']>(firstAvailable?.id ?? nft.defaultEditionId)
  const [quantity, setQuantity] = useState(1)
  const edition = nft.editions.find((e) => e.id === editionId)!
  const inCart = useCartQuantity(nft.id, editionId)
  const max = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
  const qty = Math.min(Math.max(quantity, 1), Math.max(max, 1))
  const unavailable = max === 0
  const { addItem, isPending } = useAddToCartAction()

  const add = async (goToCart: boolean) => {
    try {
      await addItem({ nftId: nft.id, name: nft.name, editionId, editionLabel: edition.label, quantity: qty })
      setQuantity(1)
      if (goToCart) await navigate({ to: '/carrinho' })
    } catch {
      // Feedback already shown by the toast.
    }
  }

  const availability = edition.available === 0
    ? 'Edição esgotada. Escolha outra edição.'
    : max === 0
      ? `Você já tem o máximo desta edição no carrinho (${inCart}).`
      : `${edition.available} disponíveis · máximo de ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`

  return (
    <div className="flex flex-col gap-5">
      <EditionPicker
        editions={nft.editions}
        selected={editionId}
        onSelect={(id) => {
          setEditionId(id)
          setQuantity(1)
        }}
      />
      <p id="disponibilidade" className={cn('text-sm', unavailable ? 'text-destructive' : 'text-sand')} aria-live="polite">
        {availability}
      </p>

      {/* Desktop actions */}
      <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
        <QuantityStepper label="Quantidade" value={qty} max={Math.max(max, 1)} onChange={setQuantity} disabled={unavailable} />
        <div className="flex gap-2">
          <Button className="w-[115px]" onClick={() => void add(true)} disabled={unavailable || isPending} aria-describedby="disponibilidade">
            COMPRAR
          </Button>
          <FavoriteButton nftId={nft.id} name={nft.name} variant="labeled" />
        </div>
      </div>

      {/* Mobile sticky purchase bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-4 rounded-t-[30px] bg-card px-6 pt-5 pb-6 shadow-sheet md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-sand">Qtd.</span>
            <QuantityStepper label="Quantidade" size="sm" value={qty} max={Math.max(max, 1)} onChange={setQuantity} disabled={unavailable} />
          </div>
          <span className="text-xl font-bold text-apricot">{formatEth(edition.price)}</span>
        </div>
        <div className="flex gap-3">
          <Button variant="pill" size="xl" className="flex-1" onClick={() => void add(true)} disabled={unavailable || isPending}>
            Comprar NFT
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-14 rounded-full border border-border-soft text-apricot"
            onClick={() => void add(false)}
            disabled={unavailable || isPending}
            aria-label="Adicionar ao carrinho"
          >
            <ShoppingCart className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,510px)_1fr]" aria-hidden>
      <div className="flex gap-6">
        <div className="hidden flex-col gap-4 lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[89px] rounded-sm" />
          ))}
        </div>
        <Skeleton className="aspect-square flex-1 rounded-sm" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-2/3" />
      </div>
    </div>
  )
}

export function NftDetailPage({ nftId }: { nftId: string }) {
  const router = useRouter()
  const { data: nft, isPending, error, refetch, isFetching } = useQuery(nftDetailQuery(nftId))

  if (isPending) {
    return (
      <div className="mx-auto max-w-page px-4 py-8 md:px-6 xl:px-0">
        <p className="sr-only" role="status">
          Carregando NFT
        </p>
        <DetailSkeleton />
      </div>
    )
  }
  if (error && isApiError(error) && error.code === 'NOT_FOUND') {
    return (
      <div className="mx-auto max-w-page px-4 py-16 md:px-6 xl:px-0">
        <EmptyState
          title="NFT não encontrado"
          description="Este NFT não existe ou foi removido do catálogo."
          action={
            <Link to="/" className="font-bold text-apricot hover:underline">
              Voltar ao catálogo
            </Link>
          }
        />
      </div>
    )
  }
  if (!nft) {
    return (
      <div className="mx-auto max-w-page px-4 py-16 md:px-6 xl:px-0">
        <ErrorState title="Não foi possível carregar este NFT" error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </div>
    )
  }

  const meta = (
    <dl className="flex flex-col gap-2 text-[15px] text-sand">
      <div>
        <dt className="inline">ID do token: </dt>
        <dd className="inline">{nft.tokenId}</dd>
      </div>
      <div>
        <dt className="inline">Coleção: </dt>
        <dd className="inline">{nft.collection.name}</dd>
      </div>
      <div>
        <dt className="inline">Atributos: </dt>
        <dd className="inline">{nft.attributes.join(', ')}</dd>
      </div>
    </dl>
  )

  return (
    <div className="mx-auto flex max-w-page flex-col gap-16 pb-64 md:px-6 md:pt-6 md:pb-8 xl:px-0">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-6 pt-5 md:hidden">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))}
          className="inline-flex size-9 items-center justify-center rounded-full bg-surface-raised text-sand"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <FavoriteButton nftId={nft.id} name={nft.name} className="size-9 rounded-full bg-surface-raised" />
      </div>

      <div className="flex flex-col gap-4">
        <nav aria-label="Trilha de navegação" className="hidden md:block">
          <ol className="flex gap-2 text-[15px] font-bold">
            <li>
              <Link to="/" className="hover:text-apricot">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/" hash="catalogo" className="hover:text-apricot">
                Mercado
              </Link>
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 md:grid-cols-[minmax(0,510px)_1fr] md:gap-8">
          <div className="px-6 md:px-0">
            <Gallery nft={nft} />
          </div>

          <div className="-mt-12 flex flex-col gap-5 rounded-t-[30px] bg-card px-6 pt-8 md:mt-0 md:rounded-none md:bg-transparent md:p-0">
            <div className="flex items-start justify-between gap-4 md:flex-col md:gap-2">
              <h1 className="text-[22px] font-bold md:text-2xl">{nft.name}</h1>
              <span className="md:hidden">
                <Rating rating={nft.rating} count={nft.reviewCount} compact />
              </span>
            </div>
            <div className="hidden items-center justify-between gap-4 border-b border-border-soft pb-3 md:flex">
              <Price price={nft.price} compareAt={nft.compareAtPrice} className="text-xl" />
              <Rating rating={nft.rating} count={nft.reviewCount} />
            </div>
            <section className="flex flex-col gap-2">
              <h2 className="hidden text-[15px] font-bold md:block">Sobre este NFT:</h2>
              <p className="text-[15px] leading-relaxed text-sand">{nft.description}</p>
            </section>
            <Purchase key={nft.id} nft={nft} />
            {meta}
            <div className="hidden md:block">
              <ShareLinks nft={nft} />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="detalhes" className="hidden gap-4 md:flex">
        <TabsList variant="line" className="h-auto w-full justify-start gap-8 rounded-none border-b border-border-soft p-0">
          {[
            ['detalhes', 'Detalhes do NFT'],
            ['avaliacoes', `Avaliações de colecionadores (${nft.reviewCount})`],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value!}
              className="h-auto flex-none rounded-none px-0 pb-2 text-base font-normal text-cream after:bottom-[-1px] after:bg-copper data-[state=active]:font-bold data-[state=active]:text-apricot dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-apricot"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="detalhes" className="flex flex-col gap-5 text-[15px] leading-relaxed text-sand">
          {nft.longDescription.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          <div>
            <h3 className="font-bold text-cream">Rede:</h3>
            <p>Cunhado na rede {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS.</p>
          </div>
          <div>
            <h3 className="font-bold text-cream">Contrato:</h3>
            <p>Direitos autorais do criador: {nft.contract.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
          </div>
          <div>
            <h3 className="font-bold text-cream">Direitos autorais:</h3>
            <p>
              {nft.contract.address.slice(0, 6)}…{nft.contract.address.slice(-4)} · Contrato inteligente {nft.contract.standard} verificado.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="avaliacoes">
          <ul className="flex flex-col gap-4">
            {nft.reviews.map((review) => (
              <li key={review.id} className="rounded-sm bg-card p-4">
                <p className="flex items-center gap-2 font-bold">
                  {review.author}
                  <span className="flex" aria-label={`${review.rating} de 5 estrelas`}>
                    {Array.from({ length: review.rating }, (_, i) => (
                      <Star key={i} className="size-3.5 fill-copper text-copper" aria-hidden />
                    ))}
                  </span>
                </p>
                <p className="text-[15px] text-sand">{review.comment}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <div className="px-6 md:px-0">
        <RelatedNfts nft={nft} />
      </div>
    </div>
  )
}
