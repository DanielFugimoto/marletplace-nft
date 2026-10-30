// Dev helper: screenshots a running app (npm run preview) for visual comparison
// with the Figma exports in design/frames.
// Usage: node scripts/screenshot.mjs <path> <out.png> [width] [height] [--full]
import { chromium } from '@playwright/test'

const [, , path = '/', out = 'shot.png', width = '1440', height = '900', ...flags] = process.argv
const base = process.env.BASE_URL ?? 'http://localhost:4173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()))
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto(base + path)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(Number(process.env.WAIT ?? 600))
await page.screenshot({ path: out, fullPage: flags.includes('--full') })
await browser.close()
console.log('saved', out)
