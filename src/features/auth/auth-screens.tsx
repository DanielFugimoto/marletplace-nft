import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { type LoginRequest, loginRequestSchema, type RegisterRequest, registerRequestSchema } from '@/api/contracts'
import { Field, FormAlert, PasswordInput } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { inputClasses } from '@/components/ui/input'
import { env } from '@/env'
import { HomePage } from '@/features/catalog/home-page'
import { useIsDesktop } from '@/hooks/use-media-query'
import { applyApiErrors, safeRedirect } from '@/lib/form-errors'
import { notifyUnavailable } from '@/lib/unavailable'
import { cn } from '@/lib/utils'
import { useLogin, useRegister } from './mutations'

type Mode = 'login' | 'register'
type AuthSearch = { redirect?: string; reason?: 'expired' }

const fieldInput = cn(inputClasses, 'h-10 rounded-sm border-border-soft max-md:h-12 max-md:rounded-lg')

function SocialButtons() {
  const btn =
    'flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-border-soft text-sm text-sand hover:border-copper hover:text-cream'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm text-cream before:h-px before:flex-1 before:bg-border-soft after:h-px after:flex-1 after:bg-border-soft">
        Ou continue com
      </div>
      <button type="button" className={btn} onClick={() => notifyUnavailable('O login com Google')}>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4086F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.2v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6z" />
          <path fill="#59C36A" d="M12 22.5c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10.5 10.5 0 0 0 12 22.5z" />
          <path fill="#FFDA2D" d="M6.2 14.1a6.3 6.3 0 0 1 0-4V7.4H2.7a10.5 10.5 0 0 0 0 9.4z" />
          <path fill="#ED1B2E" d="M12 5.6c1.5 0 2.9.5 4 1.6l3-3A10.5 10.5 0 0 0 2.7 7.4l3.5 2.7C7 7.4 9.3 5.6 12 5.6z" />
        </svg>
        Continuar com Google
      </button>
      <button type="button" className={btn} onClick={() => notifyUnavailable('O login com Facebook')}>
        <svg viewBox="0 0 24 24" className="size-5 fill-[#3B5999]" aria-hidden>
          <path d="M14 8h3V4h-3a5 5 0 0 0-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9a1 1 0 0 1 1-1z" />
        </svg>
        Continuar com Facebook
      </button>
    </div>
  )
}

function useAfterAuth(search: AuthSearch) {
  const navigate = useNavigate()
  return (message: string) => {
    toast.success(message, { id: 'auth' })
    void navigate({ to: safeRedirect(search.redirect), replace: true })
  }
}

function LoginForm({ search }: { search: AuthSearch }) {
  const login = useLogin()
  const done = useAfterAuth(search)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  })
  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    login.mutate(values, {
      onSuccess: (res) =>
        done(res.cartMerged ? `Bem-vindo, ${res.user.displayName}! Seu carrinho foi preservado.` : `Bem-vindo, ${res.user.displayName}!`),
      onError: (error) => setFormError(applyApiErrors(error, setError, ['email', 'password'])),
    })
  })
  const { errors } = formState
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <Field label="E-mail" hideLabel error={errors.email?.message}>
        {(a) => <input {...a} {...register('email')} type="email" autoComplete="email" placeholder="contato@email.com" className={fieldInput} />}
      </Field>
      <Field label="Senha" hideLabel error={errors.password?.message}>
        {(a) => <PasswordInput {...a} {...register('password')} autoComplete="current-password" placeholder="Senha" className={fieldInput} />}
      </Field>
      <button type="button" onClick={() => notifyUnavailable('A recuperação de senha')} className="self-end text-sm text-apricot hover:underline">
        Esqueceu a senha?
      </button>
      <Button type="submit" size="lg" disabled={login.isPending} aria-busy={login.isPending} className="mt-2 max-md:h-14 max-md:rounded-xl">
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
      {env.enableMocks && (
        <p className="text-center text-xs text-tan">Demonstração: ana@kurio.dev ou bruno@kurio.dev · senha Kurio@123</p>
      )}
    </form>
  )
}

function RegisterForm({ search }: { search: AuthSearch }) {
  const registerMutation = useRegister()
  const done = useAfterAuth(search)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    registerMutation.mutate(values, {
      onSuccess: (res) => done(`Conta criada! Bem-vindo, ${res.user.displayName}.`),
      onError: (error) =>
        setFormError(applyApiErrors(error, setError, ['username', 'email', 'password', 'confirmPassword'])),
    })
  })
  const { errors } = formState
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <Field label="Nome de usuário" hideLabel error={errors.username?.message}>
        {(a) => <input {...a} {...register('username')} autoComplete="username" placeholder="Nome de usuário" className={fieldInput} />}
      </Field>
      <Field label="E-mail" hideLabel error={errors.email?.message}>
        {(a) => <input {...a} {...register('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={fieldInput} />}
      </Field>
      <Field label="Senha" hideLabel error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
        {(a) => <PasswordInput {...a} {...register('password')} autoComplete="new-password" placeholder="Senha" className={fieldInput} />}
      </Field>
      <Field label="Confirmar senha" hideLabel error={errors.confirmPassword?.message}>
        {(a) => <PasswordInput {...a} {...register('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" className={fieldInput} />}
      </Field>
      <Button type="submit" size="lg" disabled={registerMutation.isPending} aria-busy={registerMutation.isPending} className="mt-2 max-md:h-14 max-md:rounded-xl">
        {registerMutation.isPending ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  )
}

const COPY: Record<Mode, { title: string; mobileTitle: string; description: string }> = {
  login: { title: 'Entrar', mobileTitle: 'Entrar', description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.' },
  register: {
    title: 'Criar conta',
    mobileTitle: 'Criar perfil de colecionador',
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
  },
}

function ModeSwitch({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const tab = 'text-xl tracking-wide hover:text-apricot aria-[current=page]:text-apricot'
  return (
    <nav aria-label="Entrar ou criar conta" className="flex items-center justify-center gap-2">
      <Link to="/login" search={search} aria-current={mode === 'login' ? 'page' : undefined} className={tab} replace>
        Entrar
      </Link>
      <span aria-hidden className="h-6 w-px bg-copper" />
      <Link to="/cadastro" search={search} aria-current={mode === 'register' ? 'page' : undefined} className={tab} replace>
        Criar conta
      </Link>
    </nav>
  )
}

function Body({ mode, search, heading }: { mode: Mode; search: AuthSearch; heading: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      {heading}
      {search.reason === 'expired' && (
        <p role="status" className="rounded-sm border border-copper px-3 py-2 text-center text-sm">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      {mode === 'login' ? <LoginForm search={search} /> : <RegisterForm search={search} />}
      <SocialButtons />
    </div>
  )
}

export function AuthScreen({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const copy = COPY[mode]

  if (isDesktop) {
    return (
      <>
        {/* The layout shows the auth modal over the home page; it stays inert behind it. */}
        <div inert aria-hidden>
          <HomePage />
        </div>
        <Dialog open onOpenChange={(open) => !open && void navigate({ to: safeRedirect(search.redirect), replace: true })}>
          <DialogContent className="w-[500px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-none border-0 border-b-[10px] border-b-copper px-20 pt-12 pb-16 sm:max-w-[500px] [&>button]:text-apricot">
            <DialogTitle className="sr-only">{copy.title}</DialogTitle>
            <Body
              mode={mode}
              search={search}
              heading={
                <div className="flex flex-col gap-6">
                  <ModeSwitch mode={mode} search={search} />
                  <DialogDescription className="text-center text-sm text-cream">{copy.description}</DialogDescription>
                </div>
              }
            />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-10 px-7 pt-28 pb-10">
      <Link to="/" className="self-center text-[34px] font-bold tracking-[0.1em]" aria-label="Kurio, página inicial">
        KURIO
      </Link>
      <Body
        mode={mode}
        search={search}
        heading={<h1 className="text-center text-xl font-bold">{copy.mobileTitle}</h1>}
      />
      <p className="text-center text-[15px] text-sand">
        {mode === 'login' ? (
          <>
            Novo na Kurio?{' '}
            <Link to="/cadastro" search={search} className="text-apricot hover:underline">
              Crie uma conta
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link to="/login" search={search} className="text-apricot hover:underline">
              Entre
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
