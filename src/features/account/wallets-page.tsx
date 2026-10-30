import type * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  NETWORK_LABEL,
  NETWORKS,
  type Profile,
  type Wallet,
  type WalletInput,
  walletInputSchema,
  WALLET_PROVIDER_LABEL,
  WALLET_PROVIDERS,
  type WalletSlot,
} from '@/api/contracts'
import { Field, FormAlert } from '@/components/form-field'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { inputClasses } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { applyApiErrors } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { useCreateWallet, useProfile, useUpdateWallet, useWallets } from './queries'

const FIELDS = [
  'displayName',
  'nickname',
  'network',
  'profileName',
  'address',
  'secondaryAddress',
  'provider',
  'referralCode',
  'email',
  'ensName',
] as const

function emptyWallet(profile: Profile | undefined): WalletInput {
  return {
    displayName: profile?.displayName ?? '',
    nickname: '',
    network: 'ethereum',
    profileName: profile?.username ?? '',
    address: '',
    secondaryAddress: '',
    provider: 'metamask',
    referralCode: '',
    email: profile?.email ?? '',
    ensName: profile?.ensName ?? '',
  }
}

const fromWallet = ({ id: _i, slot: _s, updatedAt: _u, ...input }: Wallet): WalletInput => input

function Select({ children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputClasses, 'appearance-none pr-10')}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-tan" aria-hidden />
    </div>
  )
}

function WalletForm({
  slot,
  wallet,
  defaults,
  onDone,
}: {
  slot: WalletSlot
  wallet: Wallet | undefined
  defaults: WalletInput
  onDone?: () => void
}) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, reset, formState } = useForm<WalletInput>({
    resolver: zodResolver(walletInputSchema),
    defaultValues: defaults,
  })
  const { errors } = formState
  const pending = create.isPending || update.isPending

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    const options = {
      onSuccess: (saved: Wallet) => {
        reset(fromWallet(saved))
        toast.success(slot === 'primary' ? 'Carteira principal salva' : 'Carteira secundária salva', { id: `wallet-${slot}` })
        onDone?.()
      },
      onError: (error: unknown) => setFormError(applyApiErrors(error, setError, FIELDS)),
    }
    if (wallet) update.mutate({ id: wallet.id, body: values }, options)
    else create.mutate({ ...values, slot }, options)
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'}>
      <FormAlert message={formError} />
      <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(a) => <input {...a} {...register('displayName')} className={inputClasses} />}
        </Field>
        <Field label="Apelido da carteira" required error={errors.nickname?.message}>
          {(a) => <input {...a} {...register('nickname')} className={inputClasses} />}
        </Field>
        <Field label="Rede" required error={errors.network?.message}>
          {(a) => (
            <Select {...a} {...register('network')}>
              {NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABEL[n]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nome do perfil" required error={errors.profileName?.message}>
          {(a) => <input {...a} {...register('profileName')} className={inputClasses} />}
        </Field>
        <Field label="Endereço da carteira" required error={errors.address?.message}>
          {(a) => <input {...a} {...register('address')} placeholder="Endereço 0x da carteira" spellCheck={false} className={inputClasses} />}
        </Field>
        <Field label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress?.message}>
          {(a) => <input {...a} {...register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} className={inputClasses} />}
        </Field>
        <Field label="Tipo de carteira" required error={errors.provider?.message}>
          {(a) => (
            <Select {...a} {...register('provider')}>
              {WALLET_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {WALLET_PROVIDER_LABEL[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Código de indicação" required error={errors.referralCode?.message}>
          {(a) => <input {...a} {...register('referralCode')} placeholder="Ex.: KURIO-01" className={inputClasses} />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          {(a) => <input {...a} {...register('email')} type="email" autoComplete="email" className={inputClasses} />}
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          {(a) => (
            <div className="flex gap-2">
              <span className="inline-flex h-10 items-center rounded-sm border border-border-strong px-3 text-sm">.eth</span>
              <input {...a} {...register('ensName')} spellCheck={false} className={inputClasses} />
            </div>
          )}
        </Field>
      </div>
      <Button type="submit" className="w-fit" disabled={pending} aria-busy={pending}>
        {pending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

function SecondaryWallet({ primary, secondary, profile }: { primary: Wallet | undefined; secondary: Wallet | undefined; profile: Profile | undefined }) {
  const [adding, setAdding] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const checkboxId = useId()
  const defaults = secondary
    ? fromWallet(secondary)
    : sameAsPrimary && primary
      ? { ...fromWallet(primary), nickname: 'Reserva' }
      : emptyWallet(profile)

  return (
    <section aria-labelledby="carteira-secundaria" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="carteira-secundaria" className="text-lg font-bold">
          Carteira secundária
        </h2>
        {!secondary && (
          <div className="flex items-center gap-4">
            <label htmlFor={checkboxId} className="flex items-center gap-2 text-[15px]">
              <input
                id={checkboxId}
                type="checkbox"
                checked={sameAsPrimary}
                disabled={!primary}
                onChange={(e) => setSameAsPrimary(e.target.checked)}
                className="size-4 accent-copper"
              />
              Igual à carteira principal
            </label>
            {!adding && (
              <button type="button" onClick={() => setAdding(true)} className="text-lg font-bold text-apricot hover:underline">
                Adicionar
              </button>
            )}
          </div>
        )}
      </div>
      {secondary || adding ? (
        <WalletForm
          key={`${secondary?.id ?? 'new'}-${sameAsPrimary}`}
          slot="secondary"
          wallet={secondary}
          defaults={defaults}
          onDone={() => setAdding(false)}
        />
      ) : (
        <p className="text-[15px] text-sand">Você ainda não adicionou uma carteira secundária.</p>
      )}
    </section>
  )
}

export function WalletsPage() {
  const wallets = useWallets()
  const profile = useProfile()
  const [addingPrimary, setAddingPrimary] = useState(false)

  if (wallets.isPending) {
    return (
      <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }
  if (!wallets.data) {
    return <ErrorState title="Não foi possível carregar suas carteiras" error={wallets.error} onRetry={() => void wallets.refetch()} retrying={wallets.isFetching} />
  }

  const primary = wallets.data.find((w) => w.slot === 'primary')
  const secondary = wallets.data.find((w) => w.slot === 'secondary')

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="carteira-principal" className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 id="carteira-principal" className="text-lg font-bold">
              Carteira principal
            </h1>
            <p className="text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && !addingPrimary && (
            <button type="button" onClick={() => setAddingPrimary(true)} className="text-lg font-bold text-apricot hover:underline">
              Adicionar
            </button>
          )}
        </div>
        {primary || addingPrimary ? (
          <WalletForm
            key={primary?.id ?? 'new'}
            slot="primary"
            wallet={primary}
            defaults={primary ? fromWallet(primary) : emptyWallet(profile.data)}
            onDone={() => setAddingPrimary(false)}
          />
        ) : (
          <p className="text-[15px] text-sand">Você ainda não cadastrou sua carteira principal.</p>
        )}
      </section>
      <SecondaryWallet primary={primary} secondary={secondary} profile={profile.data} />
    </div>
  )
}
