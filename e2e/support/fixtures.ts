import { test as base, expect, type Page } from '@playwright/test'
import { callApi, USERS } from './mock-api'

type User = keyof typeof USERS

export class App {
  readonly page: Page
  constructor(page: Page) {
    this.page = page
  }

  get isMobile() {
    return (this.page.viewportSize()?.width ?? 1440) < 768
  }

  /**
   * Starts from a pristine simulated backend. Every test gets a fresh browser
   * context, so localStorage (session, cart id, mock db) is isolated too.
   */
  async boot(options: { scenario?: string; latency?: 'none' | 'default'; flags?: Record<string, unknown> } = {}) {
    await this.goto('/')
    await this.api('POST', '/__mock/reset', { body: { scenario: options.scenario ?? 'default' } })
    const patch: Record<string, unknown> = {}
    if ((options.latency ?? 'none') === 'none' && !options.scenario) patch.latency = { kind: 'none' }
    if (options.flags) patch.flags = options.flags
    if (Object.keys(patch).length) await this.api('POST', '/__mock/config', { body: patch })
  }

  api<T = any>(method: string, path: string, options?: Parameters<typeof callApi>[3]) {
    return callApi<T>(this.page, method, path, options)
  }

  /** Signs in through the API and stores the session like the app does. */
  async signIn(user: User = 'ana') {
    const res = await this.api<{ token: string; user: { id: string }; expiresAt: string }>('POST', '/auth/login', {
      body: USERS[user],
    })
    expect(res.status).toBe(200)
    await this.page.evaluate(
      (s) => localStorage.setItem('kurio:session', JSON.stringify({ token: s.token, userId: s.user.id, expiresAt: s.expiresAt })),
      res.body,
    )
    return res.body.token
  }

  async seedCart(token: string, items: Array<[nftId: string, quantity: number, editionId?: string]>) {
    for (const [nftId, quantity, editionId = '1-50'] of items) {
      const res = await this.api('POST', '/cart/items', { token, body: { nftId, editionId, quantity } })
      expect(res.status).toBe(201)
    }
  }

  /** Navigates and waits until the MSW worker is intercepting for this page. */
  async goto(path: string) {
    await this.page.goto(path)
    await this.page.locator('html[data-mocks="ready"]').waitFor({ state: 'attached' })
    await this.page.locator('main#conteudo').waitFor({ state: 'attached' })
  }

  /** Changes price/availability in the backend; the app learns it via Socket.IO. */
  changeNft(nftId: string, change: { price?: string; available?: number; editionId?: string }) {
    return this.api('POST', `/__mock/nfts/${nftId}`, { body: change })
  }

  toast(text: string | RegExp) {
    return this.page.locator('[data-sonner-toast]').filter({ hasText: text })
  }

  async waitForRealtime() {
    await expect
      .poll(async () => (await this.api('GET', '/__mock/state')).body.realtime.clients.length, { message: 'socket connected' })
      .toBeGreaterThan(0)
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await use(new App(page))
  },
})

export { expect }
