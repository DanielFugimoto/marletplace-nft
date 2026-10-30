import { expect, test } from './support/fixtures'

test.describe('Tempo real (Socket.IO)', () => {
  test('nft.updated atualiza o detalhe; duplicados e eventos antigos são ignorados', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await app.waitForRealtime()

    const first = await app.changeNft('emerald-ape-042', { price: '2.00' })
    await expect(page.locator('text=2.00 ETH >> visible=true').first()).toBeVisible()
    await app.changeNft('emerald-ape-042', { price: '2.10' })
    await expect(page.locator('text=2.10 ETH >> visible=true').first()).toBeVisible()

    // Re-deliver the first (older) event and a fabricated stale one.
    await app.api('POST', '/__mock/events/replay', { body: { eventId: first.body.id } })
    await app.api('POST', '/__mock/events/stale/emerald-ape-042')
    await app.api('POST', '/__mock/events/replay')
    await page.waitForTimeout(500)
    await expect(page.locator('text=2.10 ETH >> visible=true').first()).toBeVisible()
    await expect(page.getByText('999')).toHaveCount(0)
    await expect(page.locator('text=2.00 ETH >> visible=true')).toHaveCount(0)
  })

  test('nft.updated atualiza o card no catálogo', async ({ app, page }) => {
    await app.boot()
    await app.goto('/')
    const card = page.locator('#catalogo-grade article').filter({ hasText: 'Sage Nomad #009' })
    await expect(card).toContainText('1.69 ETH')
    await app.waitForRealtime()
    await app.changeNft('sage-nomad-009', { price: '1.75' })
    await expect(card).toContainText('1.75 ETH')
  })

  test('desconexão com pedido pendente: recarregar recupera o estado sem nova compra', async ({ app, page }) => {
    await app.boot({ flags: { orderResolveMs: 4_000 } })
    const token = await app.signIn('ana')
    await app.seedCart(token, [['golden-beat-207', 1]])
    await app.goto('/pagamento')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação na rede…' })).toBeVisible()

    // Socket drops and the page reloads while the order is still pending.
    await app.api('POST', '/__mock/realtime/drop', { body: { ms: 2_000 } })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação na rede…' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15_000 })
    expect((await app.api<unknown[]>('GET', '/orders', { token })).body).toHaveLength(1)

    // A terminal order stays terminal after another reload.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  })

  test('reconexão reconcilia com a API REST', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/violet-nomad-314')
    await expect(page.getByRole('heading', { level: 1, name: 'Violet Nomad #314' })).toBeVisible()
    await app.waitForRealtime()
    // Drop the socket, change data while offline (event is lost), then reconnect.
    await app.api('POST', '/__mock/realtime/drop', { body: { ms: 1_500 } })
    await app.changeNft('violet-nomad-314', { price: '1.55' })
    await expect(app.toast('Conexão restabelecida')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=1.55 ETH >> visible=true').first()).toBeVisible()
  })
})
