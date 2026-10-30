import { expect, test } from '@playwright/test'

test('home renders with mocks active', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('SEJA DONO')
  const mswActive = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '')
  expect(mswActive).toContain('mockServiceWorker.js')
})

test('unknown route shows not found page', async ({ page }) => {
  await page.goto('/rota-que-nao-existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
