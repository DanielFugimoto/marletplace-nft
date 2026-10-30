import { expect, type Page } from '@playwright/test'

export interface ApiResult<T = unknown> {
  status: number
  body: T
}

/**
 * Calls the simulated backend from inside the page, so requests go through
 * the MSW worker exactly like the app's own requests.
 */
export async function callApi<T = any>(
  page: Page,
  method: string,
  path: string,
  options: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, path, options }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers }
      if (options.token) headers.Authorization = `Bearer ${options.token}`
      const res = await fetch(`/api${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      const text = await res.text()
      return { status: res.status, body: text ? JSON.parse(text) : null }
    },
    { method, path, options },
  )
}

/** Opens the app with a pristine simulated backend and the chosen scenario. */
export async function openWithMocks(page: Page, path = '/', scenario = 'default') {
  await page.goto(path)
  await page.locator('html[data-mocks="ready"]').waitFor({ state: 'attached' })
  const reset = await callApi(page, 'POST', '/__mock/reset', { body: { scenario } })
  expect(reset.status).toBe(200)
  // Make latency negligible for contract checks unless a scenario asks otherwise.
  if (scenario === 'default') await callApi(page, 'POST', '/__mock/config', { body: { latency: { kind: 'none' } } })
}

export async function login(page: Page, email = 'ana@kurio.dev', password = 'Kurio@123') {
  const res = await callApi<{ token: string; user: { id: string } }>(page, 'POST', '/auth/login', {
    body: { email, password },
  })
  expect(res.status).toBe(200)
  return res.body
}

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@123' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@123' },
} as const
