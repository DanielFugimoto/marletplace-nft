import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { NftImage } from '@/components/nft-image'
import { cn } from '@/lib/utils'

const SLIDES = [
  {
    nftId: 'emerald-ape-042',
    image: 'emerald-ape',
    alt: 'Emerald Ape #042: macaco com óculos redondos verdes e jaqueta college verde',
  },
  {
    nftId: 'ivory-baron-088',
    image: 'baron-black-ape',
    alt: 'Ivory Baron #088: macaco de pelo preto com blazer creme',
  },
  {
    nftId: 'golden-beat-207',
    image: 'golden-headphones',
    alt: 'Golden Beat #207: macaco dourado com fones de ouvido verdes',
  },
] as const

function SlideDots({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <div role="group" aria-label="Destaques" className="flex gap-2">
      {SLIDES.map((slide, i) => (
        <button
          key={slide.nftId}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Mostrar destaque ${i + 1} de ${SLIDES.length}`}
          aria-pressed={i === active}
          className="flex size-6 items-center justify-center"
        >
          <span className={cn('size-2 rounded-full bg-copper transition-opacity', i === active ? 'opacity-100' : 'opacity-50')} />
        </button>
      ))}
    </div>
  )
}

function useSlides() {
  const [active, setActive] = useState(0)
  return { active, setActive, slide: SLIDES[active]! }
}

/** Featured carousel. Manual only: no auto-rotation, so nothing moves on its own. */
export function HeroDesktop() {
  const { active, setActive, slide } = useSlides()
  return (
    <>
      <section aria-labelledby="hero-title" className="hidden items-center gap-10 py-12 md:grid md:grid-cols-[1fr_450px] lg:pl-12">
        <div className="flex flex-col gap-6">
          <p className="text-sm">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-[32px] leading-[1.6] font-bold lg:text-[43px] lg:leading-[70px]">
            SEJA DONO DO FUTURO
            <br />
            DA ARTE DIGITAL
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-sand">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e
            tenha uma parte da cultura da internet.
          </p>
          <div className="flex items-center gap-16">
            <Link
              to="/"
              hash="catalogo"
              className="inline-flex h-10 w-fit items-center rounded-sm bg-copper px-7 text-base font-bold text-ink hover:bg-copper-dark"
            >
              EXPLORAR
            </Link>
            <SlideDots active={active} onSelect={setActive} />
          </div>
        </div>
        <Link
          to="/nft/$nftId"
          params={{ nftId: slide.nftId }}
          className="block overflow-hidden rounded-xl"
          aria-label={`Ver destaque: ${slide.alt.split(':')[0]}`}
        >
          <NftImage image={slide.image} alt={slide.alt} priority sizes="450px" />
        </Link>
      </section>
    </>
  )
}

export function HeroMobile() {
  const { active, setActive, slide } = useSlides()
  return (
    <>
      <section
        aria-labelledby="hero-title-mobile"
        className="relative mb-6 overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--copper-light)_43%,var(--ink))_0%,color-mix(in_oklab,var(--copper)_10%,var(--ink))_100%)] p-4 md:hidden"
      >
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold">Bem-vindo à Kurio</p>
            <h1 id="hero-title-mobile" className="text-xl leading-snug font-bold tracking-wide">
              SEJA DONO DA CULTURA DIGITAL
            </h1>
            <p className="text-xs leading-relaxed text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <Link to="/" hash="catalogo" className="inline-flex items-center gap-2 text-xs font-bold text-apricot">
              EXPLORAR <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="relative">
            <NftImage image={slide.image} alt={slide.alt} priority sizes="140px" className="rounded-xl" />
            <div className="absolute -bottom-2 -left-4 w-16 overflow-hidden rounded-lg ring-2 ring-ink">
              <NftImage image="nomad-bucket-hat" alt="" sizes="64px" />
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <SlideDots active={active} onSelect={setActive} />
        </div>
      </section>
    </>
  )
}
