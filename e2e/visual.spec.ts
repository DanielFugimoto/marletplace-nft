import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'

/**
 * Visual regression with versioned baselines (e2e/__screenshots__). Data is
 * deterministic (seeded mock db, zero latency) and animations are disabled.
 * Update with `npm run test:e2e:update` after intentional UI changes.
 */
test.describe('Regressão visual', () => {
  test.beforeEach(async ({ app, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await app.boot()
  })

  const shoot = async (page: Page, name: string) => {
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    // Images are lazy; make sure everything visible has decoded.
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.loading === 'lazy' || img.complete))
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false, mask: [page.locator('[data-sonner-toaster]')] })
  }

  test('início', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.locator('#catalogo-grade article')).toHaveCount(9)
    await shoot(page, 'inicio')
  })

  test('detalhe', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await shoot(page, 'detalhe')
  })

  test('carrinho', async ({ app, page }) => {
    const token = await app.signIn('ana')
    await app.seedCart(token, [
      ['emerald-ape-042', 2],
      ['violet-nomad-314', 6],
      ['ivory-baron-088', 9],
    ])
    await app.goto('/carrinho')
    await expect(page.getByText('26.846 ETH').first()).toBeVisible()
    await shoot(page, 'carrinho')
  })

  test('pagamento', async ({ app, page }) => {
    const token = await app.signIn('ana')
    await app.seedCart(token, [
      ['emerald-ape-042', 2],
      ['violet-nomad-314', 6],
      ['ivory-baron-088', 9],
    ])
    await app.goto('/pagamento')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await shoot(page, 'pagamento')
  })
})
