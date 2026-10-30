import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ChevronDown, ChevronLeft, Loader2 } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import {
  NETWORK_LABEL,
  NETWORKS,
  type Profile,
  type Wallet,
  WALLET_PROVIDER_LABEL,
  WALLET_PROVIDERS,
  type WalletConnection,
} from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { Field, FormAlert } from '@/components/form-field'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState, errorMessage } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { inputClasses } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useConnectWallet, useDisconnectWallet, useProfile, useWallets } from '@/features/account/queries'
import { useSession } from '@/features/auth/session'
import { CouponForm } from '@/features/cart/coupon-form'
import { changedItems, useAcknowledgeCart, useCart, useCartScope, useQuote } from '@/features/cart/queries'
import { QuoteSummary } from '@/features/cart/summary'
import { applyApiErrors } from '@/lib/form-errors'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { checkoutDraft, usePersistDraft } from './draft'
import { useCreateOrder, usePendingOrder } from './orders'
import { CHECKOUT_FIELDS, type CheckoutForm, checkoutFormSchema } from './schema'

const shortAddress = (address: string) => (address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address)

function NativeSelect(props: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputClasses, 'appearance-none pr-10', props.className)} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-tan" aria-hidden />
    </div>
  )
}

function defaultsFrom(profile: Profile | undefined, wallet: Wallet | undefined): CheckoutForm {
  return {
    walletId: wallet?.id ?? '',
    network: wallet?.network ?? 'ethereum',
    displayName: wallet?.displayName || profile?.displayName || '',
    username: profile?.username ?? '',
    profileName: wallet?.profileName || profile?.username || '',
    email: wallet?.email || profile?.email || '',
    ensName: wallet?.ensName || profile?.ensName || '',
    referralCode: wallet?.referralCode ?? '',
    walletAddress: wallet?.address ?? '',
    secondaryAddress: wallet?.secondaryAddress ?? '',
    walletType: wallet?.provider ?? 'metamask',
    note: '',
  }
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'review'; connection: WalletConnection }
  | { kind: 'failed'; connection: WalletConnection; message: string }

function WalletOption({ wallet, register }: { wallet: Wallet; register: ReturnType<typeof useForm<CheckoutForm>>['register'] }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-sm border border-border-soft bg-card px-4 py-3 has-checked:border-cream has-focus-visible:outline-2 has-focus-visible:outline-apricot max-md:rounded-2xl">
      <input type="radio" value={wallet.id} {...register('walletId')} className="mt-1 size-4 accent-copper" />
      <span className="flex flex-col gap-0.5 text-sm">
        <span className="text-base font-bold">{wallet.nickname || (wallet.slot === 'primary' ? 'Principal' : 'Secundária')}</span>
        <span className="text-sand">{wallet.secondaryAddress && wallet.slot === 'secondary' ? wallet.secondaryAddress : shortAddress(wallet.address)}</span>
        <span className="text-sand">
          {WALLET_PROVIDER_LABEL[wallet.provider]} · Rede {NETWORK_LABEL[wallet.network]}
        </span>
      </span>
    </label>
  )
}

function CheckoutContent({ profile, wallets }: { profile: Profile | undefined; wallets: Wallet[] }) {
  const { user } = useSession()
  const userId = user!.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scope = useCartScope()
  const cart = useCart()
  const primary = wallets.find((w) => w.slot === 'primary') ?? wallets[0]

  const [initial] = useState(() => ({ ...defaultsFrom(profile, primary), ...checkoutDraft.load(userId) }))
  const form = useForm<CheckoutForm>({ resolver: zodResolver(checkoutFormSchema), defaultValues: initial })
  const { register, handleSubmit, setValue, setError, formState, watch, control } = form
  usePersistDraft(userId, watch)

  const walletId = useWatch({ control, name: 'walletId' })
  const network = useWatch({ control, name: 'network' })
  const quote = useQuote(network, { enabled: (cart.data?.items.length ?? 0) > 0 })
  const changes = changedItems(cart.data)

  // Picking another registered wallet fills in its details.
  const lastWallet = useRef(walletId)
  useEffect(() => {
    if (walletId === lastWallet.current) return
    lastWallet.current = walletId
    const wallet = wallets.find((w) => w.id === walletId)
    if (!wallet) return
    const next = defaultsFrom(profile, wallet)
    for (const field of ['network', 'walletAddress', 'secondaryAddress', 'walletType', 'ensName', 'email', 'referralCode', 'displayName', 'profileName'] as const) {
      setValue(field, next[field], { shouldValidate: formState.isSubmitted })
    }
  }, [walletId, wallets, profile, setValue, formState.isSubmitted])

  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const acknowledge = useAcknowledgeCart()
  const createOrder = useCreateOrder()
  const pendingOrder = usePendingOrder()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [reviewedQuoteId, setReviewedQuoteId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [showCoupon, setShowCoupon] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setConflict(null)
    setPhase({ kind: 'connecting' })
    try {
      const connection = await connect.mutateAsync({ walletId: values.walletId, network: values.network })
      const fresh = await quote.refetch()
      setReviewedQuoteId(fresh.data?.id ?? null)
      setPhase({ kind: 'review', connection })
    } catch (error) {
      setPhase({ kind: 'idle' })
      if (isApiError(error) && error.code === 'WALLET_REJECTED') {
        setFormError('A conexão foi recusada na carteira. Aprove a solicitação na sua carteira e tente novamente.')
      } else {
        setFormError(applyApiErrors(error, setError, CHECKOUT_FIELDS))
      }
    }
  })

  const quoteChanged = Boolean(quote.data && reviewedQuoteId && quote.data.id !== reviewedQuoteId)
  // Sold-out lines can't be fixed here; price/quantity changes only need acknowledgement.
  const soldOut = quote.data?.lines.some((l) => l.issue === 'sold_out') ?? false
  const needsAcceptance =
    quoteChanged || changes.length > 0 || Boolean(conflict) || (quote.data?.purchasable === false && !soldOut)

  const acceptNewValues = async () => {
    try {
      if (changedItems(cart.data).length > 0) await acknowledge.mutateAsync()
      const fresh = await quote.refetch()
      setReviewedQuoteId(fresh.data?.id ?? null)
      setConflict(null)
    } catch (error) {
      toast.error('Não foi possível atualizar os valores', { description: errorMessage(error) })
    }
  }

  const placeOrder = (connection: WalletConnection) => {
    if (!quote.data || createOrder.isPending) return
    const values = form.getValues()
    const { walletId: wId, network: net, ...buyer } = values
    createOrder.mutate(
      { quoteId: quote.data.id, network: net, walletId: wId, connectionId: connection.id, buyer },
      {
        onSuccess: (order) => {
          checkoutDraft.clear(userId)
          void navigate({ to: '/pedido/$orderId', params: { orderId: order.id }, replace: true })
        },
        onError: (error) => {
          if (isApiError(error) && (error.code === 'QUOTE_CHANGED' || error.code === 'AVAILABILITY_CONFLICT')) {
            setConflict(error.message)
            void queryClient.invalidateQueries({ queryKey: queryKeys.cartRoot(scope) })
            return
          }
          if (isApiError(error) && error.code === 'WALLET_DISCONNECTED') {
            setPhase({ kind: 'idle' })
            setFormError('Sua carteira foi desconectada. Confirme a compra novamente para reconectar.')
            return
          }
          setPhase({ kind: 'failed', connection, message: errorMessage(error) })
        },
      },
    )
  }

  const closeReview = () => {
    if (createOrder.isPending) return
    if (phase.kind === 'review' || phase.kind === 'failed') {
      disconnect.mutate(phase.connection.id)
    }
    setPhase({ kind: 'idle' })
  }

  const { errors } = formState
  const items = cart.data?.items ?? []

  if (!cart.isPending && items.length === 0) {
    return (
      <EmptyState
        title="Não há itens para pagar"
        description="Seu carrinho está vazio. Adicione NFTs para continuar."
        action={
          <Link to="/" hash="catalogo" className="font-bold text-apricot hover:underline">
            Explorar NFTs
          </Link>
        }
      />
    )
  }

  return (
    <>
      {pendingOrder && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-copper bg-card px-4 py-3">
          <span>Você tem um pedido aguardando confirmação na rede.</span>
          <Link to="/pedido/$orderId" params={{ orderId: pendingOrder.id }} className="font-bold text-apricot hover:underline">
            Acompanhar pedido
          </Link>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="grid gap-10 md:grid-cols-[1fr_405px] lg:gap-8">
        {/* Collector details (desktop frame); on mobile they follow the wallet picker. */}
        <section aria-labelledby="perfil-colecionador" className="order-2 flex flex-col gap-5 md:order-1">
          <h2 id="perfil-colecionador" className="text-lg font-bold">
            Perfil do colecionador
          </h2>
          <FormAlert message={formError} />
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="Nome de exibição" required error={errors.displayName?.message}>
              {(a) => <input {...a} {...register('displayName')} autoComplete="name" className={inputClasses} />}
            </Field>
            <Field label="Nome de usuário" required error={errors.username?.message}>
              {(a) => <input {...a} {...register('username')} autoComplete="username" className={inputClasses} />}
            </Field>
            <Field label="Rede" required error={errors.network?.message}>
              {(a) => (
                <NativeSelect {...a} {...register('network')}>
                  {NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {NETWORK_LABEL[n]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Nome do perfil" required error={errors.profileName?.message}>
              {(a) => <input {...a} {...register('profileName')} className={inputClasses} />}
            </Field>
            <Field label="Endereço da carteira" required error={errors.walletAddress?.message}>
              {(a) => <input {...a} {...register('walletAddress')} placeholder="Endereço 0x da carteira" spellCheck={false} className={inputClasses} />}
            </Field>
            <Field label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress?.message}>
              {(a) => <input {...a} {...register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} className={inputClasses} />}
            </Field>
            <Field label="Tipo de carteira" required error={errors.walletType?.message}>
              {(a) => (
                <NativeSelect {...a} {...register('walletType')}>
                  {WALLET_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {WALLET_PROVIDER_LABEL[p]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Código de indicação" required error={errors.referralCode?.message}>
              {(a) => <input {...a} {...register('referralCode')} className={inputClasses} />}
            </Field>
            <Field label="E-mail" required error={errors.email?.message}>
              {(a) => <input {...a} {...register('email')} type="email" autoComplete="email" className={inputClasses} />}
            </Field>
            <Field label="Nome ENS" required error={errors.ensName?.message}>
              {(a) => (
                <div className="flex">
                  <input {...a} {...register('ensName')} spellCheck={false} className={cn(inputClasses, 'rounded-r-none')} />
                  <span className="inline-flex h-10 items-center rounded-r-sm border border-l-0 border-border-strong px-3 text-sm">.eth</span>
                </div>
              )}
            </Field>
          </div>
          <Field label="Observação do colecionador (opcional)" error={errors.note?.message} className="max-w-sm">
            {(a) => <textarea {...a} {...register('note')} rows={5} className={cn(inputClasses, 'h-auto min-h-36 py-2')} />}
          </Field>
        </section>

        <aside aria-label="Resumo do pedido" className="order-1 flex flex-col gap-5 md:order-2">
          <section aria-labelledby="seus-nfts" className="hidden flex-col gap-3 md:flex">
            <h2 id="seus-nfts" className="text-lg font-bold">
              Seus NFTs
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 bg-card p-1 pr-4">
                  <div className="w-[70px] shrink-0">
                    <NftImage image={item.image} alt="" sizes="70px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{item.name}</p>
                    <p className="text-sm text-sand">ID do token: {item.tokenId}</p>
                  </div>
                  <span className="text-sm text-sand">(x {item.quantity})</span>
                  <span className="font-bold text-apricot tabular-nums">{formatEth(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {showCoupon ? (
              <CouponForm coupon={quote.data?.coupon} />
            ) : (
              <button type="button" onClick={() => setShowCoupon(true)} className="text-center text-[15px] hover:text-apricot">
                Tem um código promocional? <span className="text-apricot underline">Aplique aqui</span>
              </button>
            )}
            <QuoteSummary quote={quote.data} isPending={quote.isPending} />
          </section>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 flex w-full items-center justify-between text-lg font-bold md:justify-center">
              Carteira e rede
              <Link to="/perfil/carteiras" className="text-sm font-bold text-apricot hover:underline md:hidden">
                Gerenciar
              </Link>
            </legend>
            {wallets.length === 0 ? (
              <p className="rounded-sm border border-copper p-4 text-sm">
                Você ainda não cadastrou carteiras.{' '}
                <Link to="/perfil/carteiras" className="font-bold text-apricot hover:underline">
                  Cadastrar carteira
                </Link>
              </p>
            ) : (
              wallets.map((wallet) => <WalletOption key={wallet.id} wallet={wallet} register={register} />)
            )}
            {errors.walletId && <p className="text-sm text-destructive">{errors.walletId.message}</p>}
          </fieldset>

          <div className="flex items-center justify-between text-lg font-bold md:hidden">
            <span>Total:</span>
            <span className="text-apricot">{quote.data ? formatEth(quote.data.total) : '—'}</span>
          </div>

          <Button
            ref={submitRef}
            type="submit"
            size="lg"
            className="w-full max-md:fixed max-md:inset-x-7 max-md:bottom-6 max-md:z-30 max-md:h-14 max-md:w-auto max-md:rounded-2xl"
            disabled={phase.kind !== 'idle' || wallets.length === 0 || !quote.data}
          >
            Confirmar compra
          </Button>
        </aside>
      </form>

      <Dialog open={phase.kind !== 'idle'} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          onInteractOutside={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            // Opened by form submission (no trigger): return focus to the submit button.
            e.preventDefault()
            submitRef.current?.focus()
          }}
        >
          {phase.kind === 'connecting' ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center" role="status">
              <Loader2 className="size-8 animate-spin text-apricot" aria-hidden />
              <DialogTitle>Conectando à carteira…</DialogTitle>
              <DialogDescription>Aprove a solicitação de conexão na sua carteira.</DialogDescription>
            </div>
          ) : phase.kind === 'review' || phase.kind === 'failed' ? (
            <div className="flex flex-col gap-4">
              <DialogTitle>Revise seu pedido</DialogTitle>
              <DialogDescription>
                Carteira conectada: <span className="font-bold text-cream">{shortAddress(phase.connection.address)}</span> ·{' '}
                {WALLET_PROVIDER_LABEL[phase.connection.provider]} · Rede {NETWORK_LABEL[phase.connection.network]}
              </DialogDescription>

              {(needsAcceptance || soldOut) && quote.data && (
                <div role="alert" className="flex flex-col gap-2 rounded-sm border border-copper p-3 text-sm">
                  <p className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="size-4 text-apricot" aria-hidden />
                    {conflict ?? 'Os valores do pedido mudaram desde a sua revisão.'}
                  </p>
                  {!soldOut ? (
                    <Button size="sm" variant="outline" className="w-fit" onClick={() => void acceptNewValues()} disabled={acknowledge.isPending || quote.isFetching}>
                      Revisei os novos valores
                    </Button>
                  ) : (
                    <Link to="/carrinho" className="font-bold text-apricot hover:underline">
                      Ajustar itens indisponíveis no carrinho
                    </Link>
                  )}
                </div>
              )}

              <ul className="flex flex-col gap-2 text-sm">
                {quote.data?.lines.map((line) => (
                  <li key={line.itemId} className="flex justify-between gap-3">
                    <span>
                      {line.name} <span className="text-sand">(x {line.quantity})</span>
                      {line.issue && (
                        <span className="block text-xs text-apricot">
                          {line.issue === 'price_changed' ? 'Preço atualizado' : line.issue === 'sold_out' ? 'Esgotado' : 'Quantidade indisponível'}
                        </span>
                      )}
                    </span>
                    <span className="font-bold tabular-nums">{formatEth(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <QuoteSummary quote={quote.data} isPending={quote.isPending} />

              {phase.kind === 'failed' && (
                <p role="alert" className="text-sm text-destructive">
                  {phase.message} Seu carrinho foi preservado; tentar novamente não cria um pedido duplicado.
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={closeReview} disabled={createOrder.isPending}>
                  Voltar e editar
                </Button>
                <Button
                  onClick={() => placeOrder(phase.connection)}
                  disabled={createOrder.isPending || needsAcceptance || soldOut || !quote.data?.purchasable || quote.isFetching}
                  aria-busy={createOrder.isPending}
                >
                  {createOrder.isPending ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden /> Enviando pedido…
                    </>
                  ) : phase.kind === 'failed' ? (
                    'Tentar novamente'
                  ) : (
                    `Confirmar e pagar ${quote.data ? formatEth(quote.data.total) : ''}`
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

    </>
  )
}

export function CheckoutPage() {
  const router = useRouter()
  const profile = useProfile()
  const wallets = useWallets()
  const cart = useCart()
  const loading = profile.isPending || wallets.isPending || cart.isPending
  const error = profile.error ?? wallets.error ?? cart.error

  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-7 pt-5 pb-32 md:px-6 md:pt-8 md:pb-8 xl:px-0">
      <div className="relative flex items-center justify-center md:hidden">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="absolute left-0 inline-flex size-9 items-center justify-center rounded-full bg-surface-raised text-sand"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h1 className="text-xl font-bold">Pagamento com carteira</h1>
      </div>
      <nav aria-label="Trilha de navegação" className="hidden md:block">
        <ol className="flex gap-2 text-[15px] font-bold">
          <li><Link to="/" className="hover:text-apricot">Início</Link></li>
          <li aria-hidden>/</li>
          <li><Link to="/carrinho" className="hover:text-apricot">Mercado</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>
      <h1 className="hidden md:block md:sr-only">Pagamento</h1>

      {loading ? (
        <div className="grid gap-10 md:grid-cols-[1fr_405px]" aria-hidden>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-40" />
          </div>
        </div>
      ) : error && !(profile.data && wallets.data) ? (
        <ErrorState
          title="Não foi possível carregar o pagamento"
          error={error}
          onRetry={() => {
            void profile.refetch()
            void wallets.refetch()
            void cart.refetch()
          }}
        />
      ) : (
        <CheckoutContent profile={profile.data} wallets={wallets.data ?? []} />
      )}
    </div>
  )
}
