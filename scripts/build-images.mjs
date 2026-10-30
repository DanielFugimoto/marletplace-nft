// Generates responsive WebP/AVIF variants of the Figma artwork into public/nfts.
// Run with `npm run images` after changing anything in design/assets.
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'design/assets'
const OUT = 'public/nfts'
const WIDTHS = [160, 320, 640, 960]

await mkdir(OUT, { recursive: true })
for (const file of await readdir(SRC)) {
  if (!file.endsWith('.png')) continue
  const name = path.basename(file, '.png')
  for (const width of WIDTHS) {
    const image = sharp(path.join(SRC, file)).resize({ width, withoutEnlargement: true })
    await image.clone().webp({ quality: 78 }).toFile(path.join(OUT, `${name}-${width}.webp`))
    await image.clone().avif({ quality: 55 }).toFile(path.join(OUT, `${name}-${width}.avif`))
  }
  console.log('built', name)
}
