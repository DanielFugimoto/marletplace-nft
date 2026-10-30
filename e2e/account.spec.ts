import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'

const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })

// A 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.describe('Perfil do colecionador', () => {
  test('edição dos dados com validação, conflito e persistência após refresh', async ({ app, page }) => {
    await app.boot()
    await app.signIn('ana')
    await app.goto('/perfil')
    const name = field(page, 'Nome de exibição (obrigatório)')
    await expect(name).toHaveValue('Ana Ribeiro')

    await name.fill('')
    await field(page, 'E-mail (obrigatório)').fill('nao-e-email')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Informe o nome de exibição')).toBeVisible()
    await expect(page.getByText('E-mail inválido')).toBeVisible()

    // Server-side conflict: username already used by another collector.
    await name.fill('Ana R.')
    await field(page, 'E-mail (obrigatório)').fill('ana@kurio.dev')
    await field(page, 'Nome de usuário (obrigatório)').fill('bruno.nft')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Nome de usuário em uso')).toBeVisible()
    await expect(field(page, 'Nome de usuário (obrigatório)')).toBeFocused()

    await field(page, 'Nome de usuário (obrigatório)').fill('ana.r')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(app.toast('Perfil atualizado')).toBeVisible()
    await page.reload()
    await expect(field(page, 'Nome de exibição (obrigatório)')).toHaveValue('Ana R.')
    await expect(field(page, 'Nome de usuário (obrigatório)')).toHaveValue('ana.r')
  })

  test('avatar: tipo inválido, envio e remoção', async ({ app, page }) => {
    await app.boot()
    await app.signIn('ana')
    await app.goto('/perfil')
    const input = page.locator('input[type="file"]')
    await input.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByRole('alert').filter({ hasText: 'Envie uma imagem PNG, JPG ou WebP' })).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(app.toast('Avatar atualizado')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByRole('img', { name: 'Sem avatar' })).toBeVisible()
  })

  test('alteração de senha com erros e novo login', async ({ app, page }) => {
    await app.boot()
    await app.signIn('ana')
    await app.goto('/perfil')
    const current = page.getByLabel('Senha atual', { exact: true })
    const next = page.getByLabel('Nova senha', { exact: true })
    const confirm = page.getByLabel('Confirmar nova senha', { exact: true })

    await next.fill('curta')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Informe a senha atual')).toBeVisible()
    await expect(page.getByText('A senha deve ter ao menos 8 caracteres')).toBeVisible()

    await current.fill('errada123')
    await next.fill('NovaSenha9')
    await confirm.fill('NovaSenha9')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta').first()).toBeVisible()

    await current.fill('Kurio@123')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(app.toast('Perfil e senha atualizados')).toBeVisible()

    const old = await app.api('POST', '/auth/login', { body: { email: 'ana@kurio.dev', password: 'Kurio@123' } })
    expect(old.status).toBe(401)
    const fresh = await app.api('POST', '/auth/login', { body: { email: 'ana@kurio.dev', password: 'NovaSenha9' } })
    expect(fresh.status).toBe(200)
  })
})

test.describe('Carteiras', () => {
  test('edita a principal com validação e cadastra a secundária', async ({ app, page }) => {
    await app.boot()
    await app.signIn('bruno')
    await app.goto('/perfil/carteiras')
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    const address = primary.getByRole('textbox', { name: 'Endereço da carteira (obrigatório)' })
    await address.fill('0xinvalido')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText(/Endereço inválido/)).toBeVisible()
    await expect(address).toHaveAttribute('aria-invalid', 'true')

    await address.fill('0x1111111111111111111111111111111111111111')
    await primary.getByRole('textbox', { name: 'Apelido da carteira (obrigatório)' }).fill('Cofre')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(app.toast('Carteira principal salva')).toBeVisible()

    await page.getByRole('checkbox', { name: 'Igual à carteira principal' }).check()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(secondary.getByRole('textbox', { name: 'Endereço da carteira (obrigatório)' })).toHaveValue(
      '0x1111111111111111111111111111111111111111',
    )
    await secondary.getByRole('textbox', { name: 'Endereço da carteira (obrigatório)' }).fill('0x2222222222222222222222222222222222222222')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(app.toast('Carteira secundária salva')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByRole('textbox', { name: 'Apelido da carteira (obrigatório)' })).toHaveValue('Cofre')
    await expect(page.getByRole('form', { name: 'Carteira secundária' }).getByRole('textbox', { name: 'Endereço da carteira (obrigatório)' })).toHaveValue(
      '0x2222222222222222222222222222222222222222',
    )
  })
})
