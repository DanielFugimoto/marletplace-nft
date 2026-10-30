import { expect, test } from './support/fixtures'

test.describe('Acessibilidade', () => {
  test('link de pular conteúdo e navegação por teclado no header', async ({ app, page }) => {
    test.skip(app.isMobile, 'header de navegação existe apenas no desktop')
    await app.boot()
    await app.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    await page.getByRole('link', { name: 'Kurio, página inicial' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Início' })).toBeFocused()
    // Visible focus indicator.
    const outline = await page.getByRole('link', { name: 'Início' }).evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
  })

  test('diálogo prende o foco e devolve ao fechar', async ({ app, page }) => {
    await app.boot()
    await app.goto('/nft/emerald-ape-042')
    const zoom = page.getByRole('button', { name: 'Ampliar imagem' })
    await zoom.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(zoom).toBeFocused()
  })

  test('drawer de filtros no mobile prende o foco e fecha com Esc', async ({ app, page }) => {
    test.skip(!app.isMobile, 'drawer de filtros existe apenas no mobile')
    await app.boot()
    await app.goto('/')
    const trigger = page.getByRole('button', { name: 'Abrir filtros' })
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Tab')
    expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('erros de formulário ficam associados aos campos e o fluxo funciona só com teclado', async ({ app, page }) => {
    await app.boot()
    await app.goto('/login')
    const email = page.getByLabel('E-mail', { exact: true })
    await email.focus()
    await page.keyboard.press('Enter')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Informe o e-mail')

    await email.fill('ana@kurio.dev')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Kurio@123')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/$/)
  })

  test('sem overflow horizontal nas telas principais', async ({ app, page }) => {
    await app.boot()
    const token = await app.signIn('ana')
    await app.seedCart(token, [['emerald-ape-042', 1]])
    for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/pagamento', '/perfil', '/perfil/carteiras', '/login']) {
      await app.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(0)
    }
  })
})
