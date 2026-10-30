import { setupWorker } from 'msw/browser'
import { resumePendingOrders } from './domain/orders'
import { handlers } from './handlers'
import { isScenarioId, setScenario } from './scenarios'

export const worker = setupWorker(...handlers)

export async function startMockWorker() {
  // `?mock=<scenario>` selects a scenario for shareable demo links.
  const url = new URL(window.location.href)
  const requested = url.searchParams.get('mock')
  if (isScenarioId(requested)) {
    setScenario(requested)
    url.searchParams.delete('mock')
    window.history.replaceState(window.history.state, '', url)
  }

  await worker.start({
    // Assets, fonts and Vite internals are expected to pass through untouched.
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  resumePendingOrders()
  // Readiness signal for tooling (Playwright waits on it before talking to the mocks).
  document.documentElement.dataset.mocks = 'ready'
}
