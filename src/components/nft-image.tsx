import { cn } from '@/lib/utils'

const WIDTHS = [160, 320, 640, 960] as const

const srcSet = (image: string, format: 'avif' | 'webp') =>
  WIDTHS.map((w) => `/nfts/${image}-${w}.${format} ${w}w`).join(', ')

interface NftImageProps {
  image: string
  alt: string
  /** CSS `sizes` hint; defaults to a grid card. */
  sizes?: string
  /** Above-the-fold images load eagerly with high priority (LCP). */
  priority?: boolean
  className?: string
}

/** Square artwork served as AVIF/WebP in several widths (see scripts/build-images.mjs). */
export function NftImage({ image, alt, sizes = '(min-width: 1024px) 260px, 50vw', priority, className }: NftImageProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(image, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(image, 'webp')} sizes={sizes} />
      <img
        src={`/nfts/${image}-640.webp`}
        alt={alt}
        width={640}
        height={640}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        className={cn('aspect-square h-auto w-full object-cover', className)}
      />
    </picture>
  )
}
