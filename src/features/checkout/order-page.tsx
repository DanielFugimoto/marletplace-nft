import type * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Loader2, X, XCircle } from 'lucide-react'
import { NETWORK_LABEL, type Order, WALLET_PROVIDER_LABEL } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealtimeStatus } from '@/realtime/RealtimeBridge'
import { formatEth } from '@/lib/money'
import { useOrder } from './orders'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-20 text-copper" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 26 32 8l24 18v30H8z" strokeLinejoin="round" />
      <path d="M8 26l24 18 24-18" strokeLinejoin="round" />
      <path d="M8 56l18-16M56 56 38 40" />
      <rect x="16" y="14" width="32" height="20" rx="2" className="fill-surface-card" />
      <text x="32" y="23" textAnchor="middle" className="fill-copper stroke-none text-[7px] font-bold">THANK</text>
      <text x="32" y="31" textAnchor="middle" className="fill-copper stroke-none text-[7px] font-bold">YOU</text>
    </svg>
  )
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="mx-auto max-w-[578px] px-4 py-10 md:py-24">
      <article className="relative overflow-hidden rounded-sm border-b-[10px] border-copper bg-card shadow-modal">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-sm text-apricot hover:bg-surface-raised"
          aria-label="Fechar e voltar ao início"
        >
          <X className="size-5" aria-hidden />
        </button>
        {children}
      </article>
    </div>
  )
}

function Receipt({ order }: { order: Order }) {
  return (
    <>
      <header className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <ThankYouIcon />
        <h1 className="text-[15px] font-bold text-apricot">Seus NFTs agora estão na sua carteira</h1>
      </header>
      <dl className="grid grid-cols-2 gap-4 border-y border-copper px-6 py-3 text-sm sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-copper">
        <div className="sm:pr-3">
          <dt className="font-bold text-sand">ID da transação</dt>
          <dd className="text-sand">{order.transaction ? shortHash(order.transaction.hash) : '—'}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Data</dt>
          <dd className="text-sand">{dateFormat.format(new Date(order.updatedAt))}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Total</dt>
          <dd className="text-sand">{formatEth(order.total)}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold text-sand">Carteira</dt>
          <dd className="text-sand">{WALLET_PROVIDER_LABEL[order.wallet.provider]}</dd>
        </div>
      </dl>
      <section aria-labelledby="detalhes-transacao" className="flex flex-col gap-4 px-6 py-6 sm:px-11">
        <h2 id="detalhes-transacao" className="text-[15px] font-bold">
          Detalhes da transação
        </h2>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-border-soft text-[15px]">
              <th scope="col" className="pb-2 font-bold">NFTs</th>
              <th scope="col" className="pb-2 text-center font-bold">Edições</th>
              <th scope="col" className="pb-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[66px] shrink-0">
                      <NftImage image={line.image} alt="" sizes="66px" className="rounded-sm" />
                    </div>
                    <div>
                      <p className="font-bold">{line.name}</p>
                      <p className="text-sand">ID do token: {line.tokenId}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-sand">
                  (x {line.quantity})
                  <span className="block text-xs">{line.editionLabel}</span>
                </td>
                <td className="text-right font-bold text-apricot tabular-nums">{formatEth(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 border-b border-border-soft pb-3 text-[15px]">
          {order.discount !== '0' && (
            <div className="flex justify-between">
              <dt>Desconto{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
              <dd className="tabular-nums">(-) {formatEth(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd className="tabular-nums">{formatEth(order.networkFee)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd className="text-apricot tabular-nums">{formatEth(order.total)}</dd>
          </div>
        </dl>
        <p className="text-center text-sm text-sand">
          Transação confirmada na {NETWORK_LABEL[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada
          na rede.
        </p>
        {order.transaction && (
          <div className="flex flex-col items-center gap-1">
            <Button asChild size="lg">
              <a href={order.transaction.explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver no {order.network === 'ethereum' ? 'Etherscan' : 'explorador'} <ExternalLink className="size-4" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </Button>
            <p className="text-xs text-tan">Referência e link simulados para esta demonstração.</p>
          </div>
        )}
      </section>
    </>
  )
}

export function OrderPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const { data: order, isPending, error, refetch, isFetching } = useOrder(orderId)
  const realtime = useRealtimeStatus()
  const close = () => void navigate({ to: '/' })

  if (isPending) {
    return (
      <Shell onClose={close}>
        <div className="flex flex-col items-center gap-4 p-10" aria-hidden>
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Shell>
    )
  }
  if (!order) {
    if (isApiError(error) && error.code === 'NOT_FOUND') {
      return (
        <div className="mx-auto max-w-xl px-4 py-16">
          <EmptyState title="Pedido não encontrado" description="Este pedido não existe ou não pertence à sua conta." action={<Link to="/" className="font-bold text-apricot">Voltar ao início</Link>} />
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState title="Não foi possível carregar o pedido" error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </div>
    )
  }

  if (order.status === 'pending') {
    return (
      <Shell onClose={close}>
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 px-8 py-14 text-center">
          <Loader2 className="size-12 animate-spin text-apricot" aria-hidden />
          <h1 className="text-lg font-bold">Aguardando confirmação na rede…</h1>
          <p className="text-sm text-sand">
            Seu pedido foi enviado e está sendo processado na {NETWORK_LABEL[order.network]}. Você pode fechar ou recarregar esta página:
            o status será recuperado sem criar outra compra.
          </p>
          <p className="text-sm">
            Total: <span className="font-bold text-apricot">{formatEth(order.total)}</span>
          </p>
          {realtime === 'reconnecting' && (
            <p className="text-xs text-tan">Conexão em tempo real instável. Verificando o status periodicamente.</p>
          )}
        </div>
      </Shell>
    )
  }

  if (order.status === 'rejected') {
    return (
      <Shell onClose={close}>
        <div role="alert" className="flex flex-col items-center gap-4 px-8 py-14 text-center">
          <XCircle className="size-12 text-destructive" aria-hidden />
          <h1 className="text-lg font-bold">Pagamento recusado</h1>
          <p className="text-sm text-sand">{order.failureReason ?? 'A transação não foi concluída.'}</p>
          <p className="text-sm">Seus itens continuam no carrinho.</p>
          <Button asChild>
            <Link to="/carrinho">Voltar ao carrinho</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onClose={close}>
      <Receipt order={order} />
    </Shell>
  )
}
