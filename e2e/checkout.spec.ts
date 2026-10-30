import type { Page } from '@playwright/test'
import { type App, expect, test } from './support/fixtures'

async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function ordersOf(app: App, token: string) {
  return (await app.api<unknown[]>('GET', '/orders', { token })).body
}

test.describe('Pagamento e confirmação', () => {
  test('compra completa do catálogo ao recibo confirmado', async ({ app, page }) => {
    await app.boot({ flags: { orderResolveMs: 800 } })
    await app.signIn('ana')
    await app.goto('/')
    await page.locator('#catalogo-grade').getByRole('link', { name: 'Golden Signal #160', exact: true }).click()
    await page.getByRole('button', { name: app.isMobile ? 'Comprar NFT' : 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/pagamento$/)

    const dialog = await openReview(page)
    await expect(dialog.getByText('Golden Signal #160')).toBeVisible()
    await dialog.getByRole('button', { name: /Confirmar e pagar 0.406 ETH/ }).click()

    await expect(page).toHaveURL(/\/pedido\//)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByRole('cell', { name: /Golden Signal #160/ })).toBeVisible()
    await expect(page.getByText('0.406 ETH').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Ver no Etherscan/ })).toHaveAttribute('href', /etherscan\.io\/tx\/0x/)

    // Only the purchased quantities leave the cart.
    await app.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('validação dos campos impede o envio', async ({ app, page }) => {
    await app.boot()
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    const address = page.getByRole('textbox', { name: 'Endereço da carteira (obrigatório)' })
    await address.fill('0x123')
    await page.getByRole('textbox', { name: 'E-mail (obrigatório)' }).fill('invalido')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(address).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText(/Endereço inválido/)).toBeVisible()
    await expect(page.getByText('E-mail inválido')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('pagamento recusado preserva os itens no carrinho', async ({ app, page }) => {
    await app.boot({ scenario: 'payment-declined' })
    await app.api('POST', '/__mock/config', { body: { latency: { kind: 'none' }, flags: { orderResolveMs: 500 } } })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 2]])
    await app.goto('/pagamento')
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.locator('text=Golden Beat #207 >> visible=true').first()).toBeVisible()
  })

  test('cliques repetidos não criam pedidos duplicados', async ({ app, page }) => {
    await app.boot({ flags: { orderResolveMs: 800 } })
    await app.api('POST', '/__mock/config', { body: { latency: { kind: 'fixed', ms: 400 } } })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    const dialog = await openReview(page)
    const pay = dialog.getByRole('button', { name: /Confirmar e pagar/ })
    await pay.click()
    // The button is disabled while the request is in flight; force extra clicks anyway.
    await dialog.getByRole('button', { name: /Enviando pedido/ }).click({ force: true, clickCount: 3 }).catch(() => undefined)
    await expect(page).toHaveURL(/\/pedido\//)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    expect(await ordersOf(app, token)).toHaveLength(1)
  })

  test('timeout após criar o pedido recupera o mesmo pedido pela chave de idempotência', async ({ app, page }) => {
    await page.clock.install()
    await app.boot({ scenario: 'order-timeout' })
    await app.api('POST', '/__mock/config', { body: { latency: { kind: 'none' }, flags: { orderResolveMs: 1_000 } } })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(dialog.getByRole('button', { name: /Enviando pedido/ })).toBeVisible()

    // Client timeout (8s) fires, the same key is re-sent and the existing order comes back.
    await page.clock.runFor(9_000)
    await expect(page).toHaveURL(/\/pedido\//)
    await page.clock.runFor(2_000)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    expect(await ordersOf(app, token)).toHaveLength(1)
  })

  test('carteira recusa a conexão', async ({ app, page }) => {
    await app.boot({ scenario: 'wallet-rejected' })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'A conexão foi recusada na carteira' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('preço alterado via Socket.IO durante a revisão exige nova confirmação', async ({ app, page }) => {
    await app.boot({ flags: { orderResolveMs: 500 } })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['ivory-baron-088', 1]])
    await app.goto('/pagamento')
    await app.waitForRealtime()
    const dialog = await openReview(page)
    const pay = dialog.getByRole('button', { name: /Confirmar e pagar/ })
    await expect(pay).toBeEnabled()

    await app.changeNft('ivory-baron-088', { price: '1.99' })
    await expect(dialog.getByRole('alert')).toContainText('Os valores do pedido mudaram')
    await expect(pay).toBeDisabled()
    await dialog.getByRole('button', { name: 'Revisei os novos valores' }).click()
    await expect(dialog.getByRole('button', { name: /Confirmar e pagar 2.006 ETH/ })).toBeEnabled()
    await dialog.getByRole('button', { name: /Confirmar e pagar 2.006 ETH/ }).click()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByText('2.006 ETH').first()).toBeVisible()
  })

  test('preço alterado no servidor no momento da confirmação é rejeitado e revisado', async ({ app, page }) => {
    await app.boot({ scenario: 'price-change-checkout' })
    await app.api('POST', '/__mock/config', { body: { latency: { kind: 'none' }, flags: { orderResolveMs: 500 } } })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(dialog.getByRole('alert')).toContainText('Os valores do pedido mudaram')
    expect(await ordersOf(app, token)).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Revisei os novos valores' }).click()
    await dialog.getByRole('button', { name: /Confirmar e pagar 1.105 ETH/ }).click()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  })

  test('edição esgotada durante a compra bloqueia a confirmação', async ({ app, page }) => {
    await app.boot({ scenario: 'sold-out-checkout' })
    await app.api('POST', '/__mock/config', { body: { latency: { kind: 'none' } } })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(dialog.getByRole('link', { name: 'Ajustar itens indisponíveis no carrinho' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Confirmar e pagar/ })).toBeDisabled()
    expect(await ordersOf(app, token)).toHaveLength(0)
  })

  test('expiração da sessão no checkout preserva o rascunho', async ({ app, page }) => {
    await app.boot()
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    await page.getByRole('textbox', { name: 'Observação do colecionador (opcional)' }).fill('Entregar na carteira principal')
    await app.api('POST', '/__mock/sessions/expire')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Fpagamento/)
    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('Kurio@123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByRole('textbox', { name: 'Observação do colecionador (opcional)' })).toHaveValue('Entregar na carteira principal')
  })
})
