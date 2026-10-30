import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'

const summary = (page: Page) => page.getByRole('complementary', { name: 'Resumo da compra' })

test.describe('Carrinho', () => {
  test('visitante altera quantidades, remove itens, mantém após refresh e preserva ao autenticar', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/emerald-ape-042')
    await page.getByRole('button', { name: app.isMobile ? 'Comprar NFT' : 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await app.goto('/nft/golden-beat-207')
    await page.getByRole('button', { name: app.isMobile ? 'Comprar NFT' : 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)

    const s = summary(page)
    await expect(s.getByText('2.18 ETH')).toBeVisible() // 1.19 + 0.99

    await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).locator('visible=true').click()
    await expect(s.getByText('3.37 ETH')).toBeVisible()

    await page.getByRole('button', { name: 'Remover Golden Beat #207 do carrinho' }).locator('visible=true').click()
    await expect(app.toast('Golden Beat #207 removido')).toBeVisible()
    await expect(s.getByText('2.38 ETH').first()).toBeVisible()

    await page.reload()
    await expect(s.getByText('2.38 ETH').first()).toBeVisible()

    // Signing in merges the visitor cart into the account cart.
    await app.goto('/login?redirect=/carrinho')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('Kurio@123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(app.toast('Seu carrinho foi preservado')).toBeVisible()
    await expect(page.locator('text=Emerald Ape #042 >> visible=true').first()).toBeVisible()
    await expect(s.getByText('2.38 ETH').first()).toBeVisible()
  })

  test('cupom inválido, expirado, aplicado e removido com resumo coerente', async ({ app, page }) => {
    await app.boot()
    const token = await app.signIn('ana')
    await app.seedCart(token, [['emerald-ape-042', 2]])
    await app.goto('/carrinho')
    const s = summary(page)
    const input = s.getByRole('textbox', { name: 'Código promocional' }).locator('visible=true')
    const apply = s.getByRole('button', { name: 'Aplicar' }).locator('visible=true')

    await input.fill('NAOEXISTE')
    await apply.click()
    await expect(s.getByText('Código inválido').locator('visible=true')).toBeVisible()
    await input.fill('VERAO2025')
    await apply.click()
    await expect(s.getByText('Código expirado').locator('visible=true')).toBeVisible()

    await input.fill('KURIO10')
    await apply.click()
    await expect(app.toast('Código promocional aplicado')).toBeVisible()
    // subtotal 2.38, 10% = 0.238, fee 0.016 → total 2.158
    await expect(s.getByText('(-) 0.238 ETH')).toBeVisible()
    await expect(s.getByText('2.158 ETH')).toBeVisible()

    await s.getByRole('button', { name: 'Remover' }).locator('visible=true').click()
    await expect(s.getByText('2.396 ETH')).toBeVisible()
  })

  test('alteração de preço via Socket.IO é informada e atualiza o resumo', async ({ app, page }) => {
    await app.boot()
    const token = await app.signIn('ana')
    await app.seedCart(token, [['ivory-baron-088', 1]])
    await app.goto('/carrinho')
    const s = summary(page)
    await expect(s.getByText('1.806 ETH')).toBeVisible()
    await app.waitForRealtime()

    await app.changeNft('ivory-baron-088', { price: '2.05' })
    await expect(app.toast('Preço de Ivory Baron #088 atualizado')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Alguns itens mudaram' })).toBeVisible()
    await expect(s.getByText('2.066 ETH')).toBeVisible()
    await expect(s.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()

    await page.getByRole('button', { name: 'Entendi, usar valores atuais' }).click()
    await expect(s.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  })
})
