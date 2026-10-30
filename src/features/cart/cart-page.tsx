import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, ShoppingCart, Trash2 } from 'lucide-react'
import type * as React from 'react'
import { toast } from 'sonner'
import type { CartItem } from '@/api/contracts'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState, errorMessage } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { nftListQuery } from '@/features/catalog/queries'
import { QuantityStepper } from '@/features/nft/quantity-stepper'
import { formatEth } from '@/lib/money'
import { CouponForm } from './coupon-form'
import { changedItems, useAcknowledgeCart, useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from './queries'
import { QuoteSummary } from './summary'

function ChangeNotice({ items }: { items: CartItem[] }) {
  const acknowledge = useAcknowledgeCart()
  if (items.length === 0) return null
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-sm border border-copper bg-card p-4">
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="size-5 text-apricot" aria-hidden />
        Alguns itens mudaram desde que você os adicionou
      </p>
      <ul className="flex flex-col gap-1 text-sm text-sand">
        {items.map((item) => (
          <li key={item.id}>
            {item.available === 0
              ? `${item.name} (edição ${item.editionLabel}) esgotou.`
              : item.quantity > item.maxQuantity
                ? `${item.name}: restam apenas ${item.maxQuantity} unidade(s) disponíveis.`
                : `${item.name}: preço de ${formatEth(item.acknowledgedPrice)} para ${formatEth(item.unitPrice)}.`}
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        className="w-fit"
        disabled={acknowledge.isPending}
        onClick={() =>
          acknowledge.mutate(undefined, {
            onSuccess: () => toast.success('Carrinho atualizado com os valores atuais', { id: 'cart-ack' }),
            onError: (e) => toast.error('Não foi possível atualizar o carrinho', { description: errorMessage(e) }),
          })
        }
      >
        Entendi, usar valores atuais
      </Button>
    </div>
  )
}

function useItemActions(item: CartItem) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const setQuantity = (quantity: number) =>
    update.mutate(
      { itemId: item.id, quantity },
      { onError: (e) => toast.error('Não foi possível alterar a quantidade', { id: `qty-${item.id}`, description: errorMessage(e) }) },
    )
  const removeItem = () =>
    remove.mutate(item.id, {
      onSuccess: () => toast.success(`${item.name} removido do carrinho`, { id: `remove-${item.id}` }),
      onError: (e) => toast.error('Não foi possível remover o item', { description: errorMessage(e) }),
    })
  return { setQuantity, removeItem, busy: update.isPending || remove.isPending }
}

function RemoveButton({ item, onClick, disabled }: { item: CartItem; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Remover ${item.name} do carrinho`}
      className="inline-flex size-9 items-center justify-center rounded-sm text-sand hover:bg-surface-raised hover:text-apricot disabled:opacity-50"
    >
      <Trash2 className="size-5" aria-hidden />
    </button>
  )
}

function DesktopRow({ item }: { item: CartItem }) {
  const { setQuantity, removeItem, busy } = useItemActions(item)
  const changed = item.unitPrice !== item.acknowledgedPrice
  return (
    <tr className="bg-card">
      <td className="py-0 pr-4">
        <div className="flex items-center gap-4">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="block w-[70px] shrink-0">
            <NftImage image={item.image} alt={item.imageAlt} sizes="70px" />
          </Link>
          <div>
            <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="font-bold hover:text-apricot">
              {item.name}
            </Link>
            <p className="text-sm text-sand">
              ID do token: {item.tokenId} · Edição {item.editionLabel}
            </p>
          </div>
        </div>
      </td>
      <td className="px-2 font-bold text-sand tabular-nums">
        {formatEth(item.unitPrice)}
        {changed && (
          <span className="block text-xs font-normal text-apricot">
            antes {formatEth(item.acknowledgedPrice)}
          </span>
        )}
      </td>
      <td className="px-2">
        <QuantityStepper
          label={`Quantidade de ${item.name}`}
          size="sm"
          value={item.quantity}
          max={Math.max(item.maxQuantity, item.quantity)}
          onChange={setQuantity}
          disabled={busy}
        />
      </td>
      <td className="px-2 font-bold text-apricot tabular-nums">{formatEth(item.lineTotal)}</td>
      <td className="pr-4 text-right">
        <RemoveButton item={item} onClick={removeItem} disabled={busy} />
      </td>
    </tr>
  )
}

function MobileItem({ item }: { item: CartItem }) {
  const { setQuantity, removeItem, busy } = useItemActions(item)
  return (
    <li className="flex overflow-hidden rounded-[18px] bg-card">
      <div className="w-[100px] shrink-0">
        <NftImage image={item.image} alt={item.imageAlt} sizes="100px" className="h-full" />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 p-3">
        <div className="flex flex-col gap-1">
          <p className="font-bold">{item.name}</p>
          <p className="text-sm text-sand">Edição: {item.editionLabel}</p>
          <p className="text-lg font-bold text-apricot">{formatEth(item.lineTotal)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <QuantityStepper
            label={`Quantidade de ${item.name}`}
            size="sm"
            value={item.quantity}
            max={Math.max(item.maxQuantity, item.quantity)}
            onChange={setQuantity}
            disabled={busy}
          />
          <RemoveButton item={item} onClick={removeItem} disabled={busy} />
        </div>
      </div>
    </li>
  )
}

function AlsoViewed() {
  const { data, isPending } = useQuery(nftListQuery({ tab: 'em-alta', pageSize: 5, page: 1 }))
  return (
    <section aria-labelledby="tambem-viram" className="hidden flex-col gap-6 md:flex">
      <h2 id="tambem-viram" className="border-b border-border-soft pb-2 text-lg font-bold text-apricot">
        Colecionadores também viram
      </h2>
      <ul className="grid grid-cols-5 gap-5">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))
          : data?.items.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} />
              </li>
            ))}
      </ul>
    </section>
  )
}

export function CartPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const cart = useCart()
  const hasItems = (cart.data?.items.length ?? 0) > 0
  const quote = useQuote('ethereum', { enabled: hasItems })
  const changes = changedItems(cart.data)
  const canCheckout = hasItems && quote.data?.purchasable === true && changes.length === 0

  const checkout = () => void navigate({ to: '/pagamento' })
  const blockedReason = !hasItems
    ? null
    : changes.length > 0
      ? 'Revise as alterações acima para continuar.'
      : quote.data && !quote.data.purchasable
        ? 'Ajuste os itens indisponíveis para continuar.'
        : null

  let content: React.ReactNode
  if (cart.isPending) {
    content = (
      <div className="flex flex-col gap-3" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full rounded-sm" />
        ))}
      </div>
    )
  } else if (cart.isError && !cart.data) {
    content = <ErrorState title="Não foi possível carregar o carrinho" error={cart.error} onRetry={() => void cart.refetch()} retrying={cart.isFetching} />
  } else if (!hasItems) {
    content = (
      <EmptyState
        icon={<ShoppingCart className="size-8 text-apricot" aria-hidden />}
        title="Seu carrinho está vazio"
        description="Explore o catálogo e adicione NFTs para começar sua coleção."
        action={
          <Link to="/" hash="catalogo" className="font-bold text-apricot hover:underline">
            Explorar NFTs
          </Link>
        }
      />
    )
  } else {
    content = (
      <>
        <table className="hidden w-full border-separate border-spacing-y-3 text-left md:table">
          <caption className="sr-only">Itens do carrinho</caption>
          <thead>
            <tr className="text-[15px] font-bold">
              <th scope="col" className="border-b border-border-soft pb-2">NFTs</th>
              <th scope="col" className="border-b border-border-soft px-2 pb-2">Preço</th>
              <th scope="col" className="border-b border-border-soft px-2 pb-2">Edições</th>
              <th scope="col" className="border-b border-border-soft px-2 pb-2">Total</th>
              <th scope="col" className="border-b border-border-soft pb-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cart.data?.items.map((item) => (
              <DesktopRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
        <ul className="flex flex-col gap-4 md:hidden" aria-label="Itens do carrinho">
          {cart.data?.items.map((item) => (
            <MobileItem key={item.id} item={item} />
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="mx-auto flex max-w-page flex-col gap-16 px-4 pt-5 pb-[440px] md:px-6 md:pt-8 md:pb-8 xl:px-0">
      <div className="flex flex-col gap-4">
        <div className="relative flex items-center justify-center md:hidden">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="absolute left-0 inline-flex size-9 items-center justify-center rounded-full bg-surface-raised text-sand"
            aria-label="Voltar"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h1 className="text-xl font-bold">Carrinho de NFTs</h1>
        </div>
        <nav aria-label="Trilha de navegação" className="hidden md:block">
          <ol className="flex gap-2 text-[15px] font-bold">
            <li><Link to="/" className="hover:text-apricot">Início</Link></li>
            <li aria-hidden>/</li>
            <li><Link to="/" hash="catalogo" className="hover:text-apricot">Mercado</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page">Carrinho</li>
          </ol>
        </nav>
        <h1 className="hidden md:block md:sr-only">Carrinho de NFTs</h1>

        <div className="grid gap-10 md:grid-cols-[1fr_330px] lg:gap-20">
          <div className="flex min-w-0 flex-col gap-4">
            <ChangeNotice items={changes} />
            {content}
          </div>

          {hasItems && (
            <aside
              aria-label="Resumo da compra"
              className="fixed inset-x-0 bottom-0 z-30 flex max-h-[60dvh] flex-col gap-5 overflow-y-auto rounded-t-[30px] bg-card px-6 pt-6 pb-6 shadow-sheet md:static md:max-h-none md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
            >
              <h2 className="hidden border-b border-border-soft pb-3 text-lg font-bold md:block">Resumo da carteira</h2>
              <div className="hidden md:block">
                <CouponForm coupon={quote.data?.coupon} />
              </div>
              <div className="md:hidden">
                <CouponForm coupon={quote.data?.coupon} variant="mobile" />
              </div>
              {quote.isError && !quote.data ? (
                <ErrorState title="Não foi possível calcular o total" error={quote.error} onRetry={() => void quote.refetch()} retrying={quote.isFetching} />
              ) : (
                <QuoteSummary quote={quote.data} isPending={quote.isPending} />
              )}
              <div className="flex flex-col items-center gap-3">
                <Button
                  className="w-full max-md:h-14 max-md:rounded-2xl"
                  variant="default"
                  onClick={checkout}
                  disabled={!canCheckout}
                  aria-describedby={blockedReason ? 'checkout-bloqueado' : undefined}
                >
                  Conectar e finalizar
                </Button>
                {blockedReason && (
                  <p id="checkout-bloqueado" className="text-sm text-sand">
                    {blockedReason}
                  </p>
                )}
                <Link to="/" hash="catalogo" className="hidden text-[15px] text-apricot hover:underline md:inline">
                  Continuar explorando
                </Link>
              </div>
            </aside>
          )}
        </div>
      </div>
      <AlsoViewed />
    </div>
  )
}
