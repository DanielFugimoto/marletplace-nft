import { Link } from '@tanstack/react-router'
import { type FormEvent, useId, useState } from 'react'
import { CATEGORIES, CATEGORY_LABEL } from '@/api/contracts'
import { emailSchema } from '@/api/contracts/auth'
import { notifyUnavailable } from '@/lib/unavailable'
import { cn } from '@/lib/utils'

const FEATURES = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', path: 'M14 8h3V4h-3a5 5 0 0 0-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9a1 1 0 0 1 1-1z' },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com',
    path: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.5-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com',
    path: 'M4 4h4.5l3.6 5 4.2-5H19l-5.6 6.6L20 20h-4.5l-3.9-5.4L7 20H4.4l6-7z',
  },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', path: 'M5 9h3v11H5zM6.5 4a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10 9h3v1.6c.6-1 1.8-1.8 3.5-1.8 3 0 3.5 2 3.5 4.6V20h-3v-5.6c0-1.3 0-2.9-1.8-2.9S13 13 13 14.3V20h-3z' },
  { label: 'YouTube', href: 'https://www.youtube.com', path: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm7 1v6l5-3z' },
]

function Newsletter() {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = new FormData(event.currentTarget).get('email')
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'E-mail inválido')
      return
    }
    setError(null)
    notifyUnavailable('A inscrição na newsletter')
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <h2 className="text-lg leading-tight font-bold">Antecipe-se ao próximo lançamento</h2>
      <label htmlFor={id} className="sr-only">
        E-mail para novidades
      </label>
      <div className="flex">
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-10 min-w-0 flex-1 rounded-l-sm bg-surface-raised px-3 text-sm text-cream placeholder:text-tan focus-visible:outline-2 focus-visible:outline-apricot aria-invalid:outline aria-invalid:outline-destructive"
        />
        <button type="submit" className="h-10 rounded-r-sm bg-copper px-4 text-lg font-bold text-ink hover:bg-copper-dark">
          Enviar
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm leading-relaxed text-sand">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  )
}

const footerLink = 'text-[15px] text-cream hover:text-apricot hover:underline underline-offset-4'
const footerText = 'text-[15px] text-tan'

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('mx-auto mt-16 w-full max-w-page px-4 pb-24 md:px-6 md:pb-6 xl:px-0', className)}>
      <div className="grid gap-8 rounded-t-sm bg-card px-6 py-8 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
        {FEATURES.map((f) => (
          <div key={f.letter} className="flex flex-col gap-3 lg:border-r lg:border-copper lg:pr-6">
            <span aria-hidden className="flex size-[74px] items-center justify-center rounded-full bg-copper text-2xl font-bold text-ink">
              {f.letter}
            </span>
            <h2 className="text-lg font-bold">{f.title}</h2>
            <p className="text-[15px] leading-relaxed text-sand">{f.text}</p>
          </div>
        ))}
        <Newsletter />
      </div>

      <div className="grid gap-4 bg-surface-dark px-6 py-6 text-[15px] sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <span className="font-bold tracking-[0.1em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <a href="mailto:contato@email.com" className={footerLink}>
          contato@email.com
        </a>
        <a href="tel:+551140028922" className={footerLink}>
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 rounded-b-sm bg-card px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <nav aria-labelledby="footer-perfil" className="flex flex-col gap-2">
          <h2 id="footer-perfil" className="mb-1 text-lg font-bold">
            Meu perfil
          </h2>
          <Link to="/perfil" className={footerLink}>
            Meu perfil
          </Link>
          <Link to="/perfil/carteiras" className={footerLink}>
            Minhas carteiras
          </Link>
          <Link to="/favoritos" className={footerLink}>
            Lista de interesse
          </Link>
          <span className={footerText}>Atividade (em breve)</span>
          <span className={footerText}>Estúdio do criador (em breve)</span>
        </nav>
        <div className="flex flex-col gap-2">
          <h2 className="mb-1 text-lg font-bold">Central de ajuda</h2>
          {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map(
            (label) => (
              <span key={label} className={footerText}>
                {label}
              </span>
            ),
          )}
          <span className="text-xs text-tan">Conteúdo editorial fora do escopo desta versão.</span>
        </div>
        <nav aria-labelledby="footer-colecoes" className="flex flex-col gap-2">
          <h2 id="footer-colecoes" className="mb-1 text-lg font-bold">
            Coleções
          </h2>
          {CATEGORIES.slice(0, 5).map((c) => (
            <Link key={c} to="/" search={{ categories: [c] }} hash="catalogo" className={footerLink}>
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Redes sociais</h2>
          <ul className="flex gap-2">
            {SOCIAL.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.label} (abre em nova aba)`}
                  className="flex size-8 items-center justify-center rounded-sm border border-copper text-apricot hover:bg-copper/10"
                >
                  <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                    <path d={s.path} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <h2 className="mt-2 text-lg font-bold">Carteiras compatíveis</h2>
          <p className="w-fit rounded-sm border border-border-soft bg-surface-dark px-2 py-1 text-[10px] font-bold tracking-wide text-apricot">
            METAMASK · WALLETCONNECT · COINBASE
          </p>
        </div>
      </div>

      <p className="py-4 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
