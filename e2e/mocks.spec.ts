import { expect, test } from '@playwright/test'
import { callApi, login, openWithMocks, USERS } from './support/mock-api'

/**
 * Contract-level checks of the simulated backend. They run in the browser so
 * every request goes through the MSW worker, like the app's own traffic.
 */
test.describe('mock backend contracts', () => {
  test.skip(({ isMobile }) => isMobile, 'contract checks are viewport independent')

  test.beforeEach(async ({ page }) => {
    // A route that doesn't query the catalog, so app traffic can't consume injected faults.
    await openWithMocks(page, '/contratos')
  })

  test('catalog supports search, combined filters, sorting and pagination', async ({ page }) => {
    const all = await callApi(page, 'GET', '/nfts?pageSize=9')
    expect(all.status).toBe(200)
    expect(all.body.total).toBeGreaterThanOrEqual(40)
    expect(all.body.items).toHaveLength(9)
    expect(all.body.items[0].name).toBe('Emerald Ape #042')

    const page2 = await callApi(page, 'GET', '/nfts?pageSize=9&page=2')
    expect(page2.body.items[0].id).not.toBe(all.body.items[0].id)

    const search = await callApi(page, 'GET', '/nfts?q=golden')
    expect(search.body.total).toBeGreaterThan(0)
    expect(
      search.body.items.every((n: { name: string; collection: { name: string } }) =>
        /golden/i.test(`${n.name} ${n.collection.name}`),
      ),
    ).toBe(true)

    const combined = await callApi(page, 'GET', '/nfts?categories=musica&networks=solana&sort=preco-asc')
    const prices = combined.body.items.map((n: { price: string }) => Number(n.price))
    expect(combined.body.items.every((n: { category: string; network: string }) => n.category === 'musica' && n.network === 'solana')).toBe(true)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))

    const empty = await callApi(page, 'GET', '/nfts?q=nao-existe-nada')
    expect(empty.body).toMatchObject({ total: 0, items: [] })

    const missing = await callApi(page, 'GET', '/nfts/inexistente-000')
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('NOT_FOUND')
  })

  test('auth: invalid credentials, register conflict and session probe', async ({ page }) => {
    const bad = await callApi(page, 'POST', '/auth/login', { body: { email: USERS.ana.email, password: 'errada123' } })
    expect(bad.status).toBe(401)
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS')

    const conflict = await callApi(page, 'POST', '/auth/register', {
      body: { username: 'outra.pessoa', email: USERS.ana.email, password: 'Senha1234', confirmPassword: 'Senha1234' },
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.fieldErrors.email).toBeTruthy()

    const invalid = await callApi(page, 'POST', '/auth/register', {
      body: { username: 'x', email: 'nope', password: '123', confirmPassword: '321' },
    })
    expect(invalid.status).toBe(422)
    expect(Object.keys(invalid.body.error.fieldErrors)).toEqual(
      expect.arrayContaining(['username', 'email', 'password']),
    )

    const { token } = await login(page)
    const session = await callApi(page, 'GET', '/auth/session', { token })
    expect(session.body.user.email).toBe(USERS.ana.email)

    await callApi(page, 'POST', '/__mock/sessions/expire')
    const expired = await callApi(page, 'GET', '/me/favorites', { token })
    expect(expired.status).toBe(401)
    expect(expired.body.error.code).toBe('SESSION_EXPIRED')
  })

  test('guest cart merges into user cart on login, respecting limits and coupons', async ({ page }) => {
    const guest = await callApi(page, 'POST', '/cart/items', {
      body: { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
    })
    expect(guest.status).toBe(201)
    const cartId = guest.body.id

    const tooMany = await callApi(page, 'POST', '/cart/items', {
      headers: { 'X-Cart-Id': cartId },
      body: { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 50 },
    })
    expect(tooMany.status).toBe(409)
    expect(tooMany.body.error.code).toBe('QUANTITY_LIMIT')

    const loginRes = await callApi(page, 'POST', '/auth/login', {
      headers: { 'X-Cart-Id': cartId },
      body: USERS.ana,
    })
    expect(loginRes.body.cartMerged).toBe(true)
    const token = loginRes.body.token
    const cart = await callApi(page, 'GET', '/cart', { token })
    expect(cart.body.owner).toBe('user')
    expect(cart.body.items[0]).toMatchObject({ nftId: 'emerald-ape-042', quantity: 2, lineTotal: '2.38' })

    for (const [code, expected] of [
      ['NAOEXISTE', 'COUPON_INVALID'],
      ['VERAO2025', 'COUPON_EXPIRED'],
    ] as const) {
      const res = await callApi(page, 'PUT', '/cart/coupon', { token, body: { code } })
      expect(res.body.error.code).toBe(expected)
    }
    await callApi(page, 'PUT', '/cart/coupon', { token, body: { code: 'kurio10' } })
    const quote = await callApi(page, 'GET', '/cart/quote?network=ethereum', { token })
    expect(quote.body).toMatchObject({
      subtotal: '2.38',
      discount: '0.238',
      networkFee: '0.016',
      total: '2.158',
      purchasable: true,
    })
  })

  test('orders are idempotent, settle via simulation and only remove purchased items', async ({ page }) => {
    await callApi(page, 'POST', '/__mock/config', { body: { flags: { orderResolveMs: 300 } } })
    const { token } = await login(page)
    await callApi(page, 'POST', '/cart/items', { token, body: { nftId: 'golden-beat-207', editionId: '1-50', quantity: 3 } })
    const quote = await callApi(page, 'GET', '/cart/quote?network=ethereum', { token })
    const conn = await callApi(page, 'POST', '/wallet-connections', {
      token,
      body: { walletId: 'wallet-ana-primary', network: 'ethereum' },
    })
    expect(conn.status).toBe(201)

    const body = {
      quoteId: quote.body.id,
      network: 'ethereum',
      walletId: 'wallet-ana-primary',
      connectionId: conn.body.id,
      buyer: {
        displayName: 'Ana Ribeiro',
        username: 'ana.colecionadora',
        profileName: 'Ana',
        email: 'ana@kurio.dev',
        ensName: 'ana',
        referralCode: 'KURIO-01',
        walletAddress: '0xA91F3c2B7d4E5f60718293a4B5c6D7e8F9a0E82C',
        secondaryAddress: '',
        walletType: 'metamask',
        note: '',
      },
    }
    const headers = { 'Idempotency-Key': 'attempt-0001' }
    const first = await callApi(page, 'POST', '/orders', { token, body, headers })
    expect(first.status).toBe(201)
    expect(first.body.status).toBe('pending')

    const retry = await callApi(page, 'POST', '/orders', { token, body, headers })
    expect(retry.status).toBe(200)
    expect(retry.body.id).toBe(first.body.id)

    const conflict = await callApi(page, 'POST', '/orders', {
      token,
      headers,
      body: { ...body, buyer: { ...body.buyer, note: 'outro' } },
    })
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT')

    await expect
      .poll(async () => (await callApi(page, 'GET', `/orders/${first.body.id}`, { token })).body.status)
      .toBe('confirmed')
    const cart = await callApi(page, 'GET', '/cart', { token })
    expect(cart.body.items).toHaveLength(0)

    // Another user cannot see this order.
    const bruno = await login(page, USERS.bruno.email, USERS.bruno.password)
    const foreign = await callApi(page, 'GET', `/orders/${first.body.id}`, { token: bruno.token })
    expect(foreign.status).toBe(404)
  })

  test('price change during checkout requires a new confirmation', async ({ page }) => {
    const { token } = await login(page)
    await callApi(page, 'POST', '/cart/items', { token, body: { nftId: 'ivory-baron-088', editionId: '1-50', quantity: 1 } })
    const quote = await callApi(page, 'GET', '/cart/quote?network=ethereum', { token })
    await callApi(page, 'POST', '/__mock/nfts/ivory-baron-088', { body: { price: '2.05' } })

    const updated = await callApi(page, 'GET', '/cart/quote?network=ethereum', { token })
    expect(updated.body.id).not.toBe(quote.body.id)
    expect(updated.body.lines[0].issue).toBe('price_changed')
    expect(updated.body.purchasable).toBe(false)

    await callApi(page, 'POST', '/cart/acknowledge', { token })
    const acknowledged = await callApi(page, 'GET', '/cart/quote?network=ethereum', { token })
    expect(acknowledged.body).toMatchObject({ subtotal: '2.05', purchasable: true })
  })

  test('fault injection: offline, HTTP errors and transient failures', async ({ page }) => {
    await callApi(page, 'POST', '/__mock/faults', {
      body: { method: 'GET', path: '/nfts', action: { type: 'status', status: 503, code: 'TRANSIENT' }, times: 1 },
    })
    expect((await callApi(page, 'GET', '/nfts')).status).toBe(503)
    expect((await callApi(page, 'GET', '/nfts')).status).toBe(200)

    await callApi(page, 'POST', '/__mock/scenario', { body: { scenario: 'offline' } })
    const offline = await page.evaluate(() => fetch('/api/nfts').then(() => 'ok', () => 'network-error'))
    expect(offline).toBe('network-error')
  })

  test('realtime broker speaks the Socket.IO protocol and broadcasts nft.updated', async ({ page }) => {
    const frames = await page.evaluate(async () => {
      const received: string[] = []
      const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`)
      socket.onmessage = (e) => received.push(String(e.data))
      await new Promise((r) => (socket.onopen = r))
      socket.send('40')
      await new Promise((r) => setTimeout(r, 100))
      await fetch('/api/__mock/nfts/emerald-ape-042', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: '1.25' }),
      })
      await new Promise((r) => setTimeout(r, 100))
      socket.close()
      return received
    })
    expect(frames[0]).toMatch(/^0\{/)
    expect(frames).toContain('40{"sid":"test"}')
    const event = frames.find((f) => f.startsWith('42'))
    expect(event).toBeTruthy()
    const [name, payload] = JSON.parse(event!.slice(2))
    expect(name).toBe('nft.updated')
    expect(payload).toMatchObject({ resource: { type: 'nft', id: 'emerald-ape-042' }, version: 2, data: { price: '1.25' } })
  })

  test('order.updated is delivered only to the owner socket', async ({ page }) => {
    await callApi(page, 'POST', '/__mock/config', { body: { flags: { orderResolveMs: 200 } } })
    const ana = await login(page)
    const bruno = await login(page, USERS.bruno.email, USERS.bruno.password)
    await callApi(page, 'POST', '/cart/items', { token: ana.token, body: { nftId: 'golden-signal-160', editionId: 'open', quantity: 1 } })
    const quote = await callApi(page, 'GET', '/cart/quote?network=ethereum', { token: ana.token })
    const conn = await callApi(page, 'POST', '/wallet-connections', {
      token: ana.token,
      body: { walletId: 'wallet-ana-primary', network: 'ethereum' },
    })

    const received = await page.evaluate(
      async ({ anaToken, brunoToken, orderBody }) => {
        const open = (token?: string) =>
          new Promise<{ socket: WebSocket; frames: string[] }>((resolve) => {
            const frames: string[] = []
            const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`)
            socket.onmessage = (e) => frames.push(String(e.data))
            socket.onopen = () => {
              socket.send(token ? `40${JSON.stringify({ token })}` : '40')
              resolve({ socket, frames })
            }
          })
        const sockets = { ana: await open(anaToken), bruno: await open(brunoToken), guest: await open() }
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anaToken}`, 'Idempotency-Key': 'scope-0001' },
          body: JSON.stringify(orderBody),
        })
        await new Promise((r) => setTimeout(r, 600))
        const orderEvents = (frames: string[]) => frames.filter((f) => f.startsWith('42["order.updated"'))
        const out = {
          ana: orderEvents(sockets.ana.frames).length,
          bruno: orderEvents(sockets.bruno.frames).length,
          guest: orderEvents(sockets.guest.frames).length,
        }
        Object.values(sockets).forEach(({ socket }) => socket.close())
        return out
      },
      {
        anaToken: ana.token,
        brunoToken: bruno.token,
        orderBody: {
          quoteId: quote.body.id,
          network: 'ethereum',
          walletId: 'wallet-ana-primary',
          connectionId: conn.body.id,
          buyer: {
            displayName: 'Ana Ribeiro',
            username: 'ana.colecionadora',
            profileName: 'Ana',
            email: 'ana@kurio.dev',
            ensName: 'ana',
            referralCode: 'KURIO-01',
            walletAddress: '0xA91F3c2B7d4E5f60718293a4B5c6D7e8F9a0E82C',
            secondaryAddress: '',
            walletType: 'metamask',
            note: '',
          },
        },
      },
    )
    expect(received).toEqual({ ana: 1, bruno: 0, guest: 0 })
  })
})
