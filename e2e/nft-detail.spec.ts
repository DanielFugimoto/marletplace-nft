import { expect, test } from './support/fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto exibe galeria, edições e respeita o limite de quantidade', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.locator('text=1.19 ETH >> visible=true').first()).toBeVisible()

    // The 1/1 edition allows a single unit per order.
    await page.getByText('1/1', { exact: true }).click()
    const increase = page.getByRole('button', { name: 'Aumentar quantidade' })
    await expect(increase).toBeDisabled()
    await page.getByText('1/10', { exact: true }).click()
    for (let i = 0; i < 6; i++) if (await increase.isEnabled()) await increase.click()
    await expect(page.getByRole('group', { name: 'Quantidade' }).locator('output')).toHaveText('5')
    await expect(increase).toBeDisabled()
  })

  test('edição esgotada fica indisponível para seleção', async ({ app, page }) => {
    await app.boot()
    await app.changeNft('emerald-ape-042', { editionId: '1-10', available: 0 })
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('radio', { name: /1\/10 \(esgotada\)/ })).toBeDisabled()
  })

  test('NFT inexistente mostra estado de não encontrado', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('comprar adiciona ao carrinho e navega para ele', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/ivory-baron-088')
    await page.getByRole('button', { name: app.isMobile ? 'Comprar NFT' : 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.locator('text=Ivory Baron #088 >> visible=true').first()).toBeVisible()
  })
})

test.describe('Favoritos', () => {
  test('persistem para o usuário autenticado', async ({ app, page }) => {
    await app.boot()
    await app.signIn('ana')
    await app.goto('/nft/golden-beat-207')
    const fav = page.getByRole('button', { name: /Adicionar Golden Beat #207 aos favoritos|^Favoritar$/ }).first()
    await fav.click()
    await expect(app.toast('adicionado aos favoritos')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { pressed: true, name: /Golden Beat #207|Favoritado/ }).first()).toBeVisible()
  })

  test('falha na mutation desfaz a atualização otimista', async ({ app, page }) => {
    await app.boot({ scenario: 'favorites-failure' })
    await app.signIn('ana')
    await app.goto('/nft/golden-beat-207')
    // Stable locator: the accessible name changes with the state.
    const fav = page.locator('button[aria-pressed]:visible').filter({ hasText: /Favorit/ }).or(page.getByRole('button', { name: /Golden Beat #207 (aos|dos) favoritos/ })).first()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(app.toast('Não foi possível atualizar seus favoritos')).toBeVisible()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await expect(app.toast('Não foi possível atualizar seus favoritos')).toBeHidden({ timeout: 10_000 })

    // Once the backend recovers, the same action succeeds.
    await app.api('DELETE', '/__mock/faults')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
  })

  test('visitante é levado ao login ao favoritar', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/golden-beat-207')
    await page.getByRole('button', { name: /Adicionar Golden Beat #207 aos favoritos|^Favoritar$/ }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })
})
