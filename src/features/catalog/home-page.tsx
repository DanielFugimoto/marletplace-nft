import { CatalogSection } from './catalog-section'
import { MintJournal, PromoBanners } from './editorial'
import { HeroDesktop, HeroMobile } from './hero'

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-page flex-col gap-16 px-4 pt-6 pb-8 md:gap-24 md:px-6 md:pt-0 xl:px-0">
      <div className="hidden md:block">
        <HeroDesktop />
      </div>
      <CatalogSection mobileIntro={<HeroMobile />} />
      <PromoBanners />
      <MintJournal />
    </div>
  )
}
