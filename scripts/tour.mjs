// Dev helper: screenshots every screen (desktop + mobile) of a running preview,
// signed in as the demo collector with items in the cart.
// Usage: node scripts/tour.mjs <outDir> [route-filter]
import { chromium } from '@playwright/test'

const [, , outDir = 'tour', filter = ''] = process.argv
const base = process.env.BASE_URL ?? 'http://localhost:4173'
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 414, height: 896 } }
const PAGES = [
  ['home', '/', false],
  ['detalhe', '/nft/emerald-ape-042', false],
  ['carrinho', '/carrinho', true],
  ['pagamento', '/pagamento', true],
  ['login', '/login', false],
  ['cadastro', '/cadastro', false],
  ['perfil', '/perfil', true],
  ['carteiras', '/perfil/carteiras', true],
  ['404', '/nao-existe', false],
]

const browser = await chromium.launch()
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const [name, path, auth] of PAGES) {
    if (filter && !name.includes(filter)) continue
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log(`[${name}] page error:`, e.message))
    await page.goto(base + '/')
    await page.waitForFunction(() => navigator.serviceWorker?.controller)
    await page.evaluate(async (auth) => {
      const call = (method, url, body, token) =>
        fetch('/api' + url, {
          method,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        }).then((r) => r.json())
      await call('POST', '/__mock/reset', {})
      if (!auth) return
      const s = await call('POST', '/auth/login', { email: 'ana@kurio.dev', password: 'Kurio@123' })
      for (const [nftId, quantity] of [['emerald-ape-042', 2], ['violet-nomad-314', 6], ['ivory-baron-088', 9]])
        await call('POST', '/cart/items', { nftId, editionId: '1-50', quantity }, s.token)
      localStorage.setItem('kurio:session', JSON.stringify({ token: s.token, userId: s.user.id, expiresAt: s.expiresAt }))
    }, auth)
    await page.goto(base + path)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${outDir}/${name}-${vpName}.png`, fullPage: vpName === 'desktop' })
    await context.close()
    console.log('shot', name, vpName)
  }
}
await browser.close()
