import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { NftImage } from '@/components/nft-image'
import { notifyUnavailable } from '@/lib/unavailable'

export function PromoBanners() {
  return (
    <section aria-label="Coleções em destaque" className="grid gap-6 md:grid-cols-2">
      <article className="grid grid-cols-2 overflow-hidden rounded-sm bg-card">
        <NftImage image="emerald-ape" alt="" sizes="(min-width: 768px) 290px, 50vw" />
        <div className="flex flex-col items-end justify-center gap-3 p-4 text-right">
          <h2 className="text-base font-bold lg:text-lg">Lançamentos gênesis de edição limitada</h2>
          <p className="text-sm text-sand">Colecione edições escassas diretamente dos criadores antes da revelação pública.</p>
          <Link
            to="/"
            search={{ tab: 'novos' }}
            hash="catalogo"
            className="inline-flex h-9 items-center gap-1 rounded-sm bg-copper px-4 text-sm font-bold text-ink hover:bg-copper-dark"
          >
            Explorar <ArrowRight className="size-4" aria-hidden />
            <span className="sr-only">lançamentos gênesis</span>
          </Link>
        </div>
      </article>
      <article className="grid grid-cols-2 overflow-hidden rounded-sm bg-card">
        <NftImage image="baron-black-ape" alt="" sizes="(min-width: 768px) 290px, 50vw" />
        <div className="flex flex-col items-end justify-center gap-3 p-4 text-right">
          <h2 className="text-base font-bold lg:text-lg">Arte digital selecionada e muito mais</h2>
          <p className="text-sm text-sand">Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.</p>
          <Link
            to="/"
            search={{ categories: ['arte-digital'] }}
            hash="catalogo"
            className="inline-flex h-9 items-center gap-1 rounded-sm bg-copper px-4 text-sm font-bold text-ink hover:bg-copper-dark"
          >
            Explorar <ArrowRight className="size-4" aria-hidden />
            <span className="sr-only">arte digital</span>
          </Link>
        </div>
      </article>
    </section>
  )
}

const POSTS = [
  { image: 'baron-black-ape', date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.' },
  { image: 'emerald-ape', date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { image: 'nomad-bucket-hat', date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { image: 'golden-headphones', date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
]

export function MintJournal() {
  return (
    <section aria-labelledby="diario" className="flex flex-col items-center gap-3">
      <h2 id="diario" className="text-2xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="text-center text-sm text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-6 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-sm bg-card">
              <NftImage image={post.image} alt="" sizes="(min-width: 1024px) 270px, 50vw" className="aspect-[3/2]" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-xs text-sand">
                  {post.date} | Leitura de {post.read}
                </p>
                <h3 className="font-bold">{post.title}</h3>
                <p className="text-xs leading-relaxed text-sand">{post.text}</p>
                <button
                  type="button"
                  onClick={() => notifyUnavailable('O Diário da Cunhagem')}
                  className="mt-auto w-fit text-xs font-bold text-apricot hover:underline"
                >
                  Ler mais →<span className="sr-only"> sobre {post.title}</span>
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
