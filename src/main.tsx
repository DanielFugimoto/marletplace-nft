import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './styles/index.css'

import { env } from './env'

async function bootstrap() {
  // Download the app while the mock worker starts, but mount only once mocks are
  // intercepting (the first render already issues requests). socket.io-client is
  // imported lazily by the app, after this point, so it sees the patched WebSocket.
  const app = import('./app')
  if (env.enableMocks) {
    const { startMockWorker } = await import('./mocks/browser')
    await startMockWorker()
  }
  const { mountApp } = await app
  mountApp(document.getElementById('root')!)
}

void bootstrap()
