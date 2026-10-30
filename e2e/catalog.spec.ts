import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'

const cardTitles = (page: Page) => page.locator('#catalogo-grade article h3')
const settled = (page: Page) => expect(page.locator('#catalogo-grade')).toHaveAttribute('aria-busy', 'false')

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e restauração pelo histórico', async ({ app, page }) => {
    await app.boot()
    await app.goto('/')
    await expect(cardTitles(page)).toHaveCount(9)
    await expect(cardTitles(page).first()).toHaveText('Emerald Ape #042')

    // Pagination
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(cardTitles(page).first()).not.toHaveText('Emerald Ape #042')
    const page2First = await cardTitles(page).first().textContent()

    // Filter change resets pagination; filters combine.
    if (app.isMobile) await page.getByRole('button', { name: 'Abrir filtros' }).click()
    await page.getByRole('button', { name: /^Música/ }).click()
    await expect(page).not.toHaveURL(/page=/)
    await page.getByRole('button', { name: /^Solana/ }).click()
    if (app.isMobile) await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/categories=.*musica/)
    await expect(page).toHaveURL(/networks=.*solana/)
    await expect(page.getByRole('button', { name: 'Remover filtro Música' })).toBeVisible()
    await settled(page)

    // Sorting by lowest price
    await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=preco-asc/)
    await settled(page)
    const prices = await page.locator('#catalogo-grade article p span:first-child').allTextContents()
    const values = prices.map((p) => Number(p.replace(/[^\d.]/g, '')))
    expect(values).toEqual([...values].sort((a, b) => a - b))

    // Search (debounced) narrows results
    await page.getByRole('searchbox', { name: /Buscar NFTs/ }).fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    for (const title of await cardTitles(page).allTextContents()) expect(title).toMatch(/golden|beat|signal|rhythm|echo|frequency/i)

    // History restores previous states, and refresh keeps the URL state.
    await page.goBack()
    await expect(page).not.toHaveURL(/q=golden/)
    await expect(page).toHaveURL(/sort=preco-asc/)
    await page.reload()
    await expect(page).toHaveURL(/sort=preco-asc/)
    await expect(page.getByRole('button', { name: 'Remover filtro Solana' })).toBeVisible()
    await page.goBack()
    await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(cardTitles(page).first()).toHaveText(page2First!)
  })

  test('resultado vazio oferece limpar filtros', async ({ app, page }) => {
    await app.boot()
    await app.goto('/?q=%22nada-por-aqui%22')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
    await expect(cardTitles(page)).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem a busca atual', async ({ app, page }) => {
    await app.boot({ scenario: 'out-of-order' })
    await app.goto('/')
    await expect(cardTitles(page)).toHaveCount(9)
    const search = page.getByRole('searchbox', { name: /Buscar NFTs/ })
    // First query is the slowest; the second resolves first. The UI must end on the latest.
    await search.fill('ape')
    await expect(page).toHaveURL(/q=ape/)
    await search.fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    await page.waitForTimeout(2_000)
    const titles = await cardTitles(page).allTextContents()
    expect(titles.length).toBeGreaterThan(0)
    for (const title of titles) expect(title).not.toMatch(/\bape\b/i)
  })

  test('skeletons durante carregamento lento, erro e recuperação após nova tentativa', async ({ app, page }) => {
    await app.boot({ scenario: 'slow' })
    await app.api('POST', '/__mock/faults', {
      body: { method: 'GET', path: '/nfts', action: { type: 'status', status: 500, code: 'INTERNAL' }, times: 3 },
    })
    await app.goto('/')
    await expect(page.getByRole('list', { name: 'Carregando NFTs' })).toBeVisible()
    await expect(page.locator('[data-slot="skeleton"]:visible').first()).toBeVisible()
    // 500 is not retried automatically (only transient errors are).
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15_000 })
    await app.api('POST', '/__mock/scenario', { body: { scenario: 'default' } })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cardTitles(page)).toHaveCount(9)
  })
})
