import { delay, http, HttpResponse } from 'msw'
import { mockConfig, saveConfig, type FaultRule, type Latency } from '../scenarios'
import { api, apiRelative, fail } from '../utils'

let requestSeq = 0
let catalogSeq = 0

/** Deterministic sequence in [0, 1) so variable latency is reproducible. */
function sequenceRandom(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function latencyFor(latency: Latency, method: string, path: string) {
  requestSeq += 1
  switch (latency.kind) {
    case 'none':
      return 0
    case 'fixed':
      return latency.ms
    case 'variable':
      return Math.round(latency.min + sequenceRandom(requestSeq) * (latency.max - latency.min))
    case 'out-of-order': {
      if (method === 'GET' && path === '/nfts') {
        catalogSeq += 1
        return [1_500, 900, 300][(catalogSeq - 1) % 3]!
      }
      return 150
    }
  }
}

function matchFault(method: string, path: string): FaultRule | undefined {
  const config = mockConfig.current
  const rule = config.faults.find(
    (f) => (f.method === '*' || f.method === method) && path.startsWith(f.path) && (f.times ?? 1) > 0,
  )
  if (rule?.times !== undefined) {
    rule.times -= 1
    saveConfig(config)
  }
  return rule
}

export const resetNetworkCounters = () => {
  requestSeq = 0
  catalogSeq = 0
}

/**
 * Runs before every API handler: applies the active latency profile and any
 * matching fault rule. Returning nothing lets MSW fall through to the
 * resource handler.
 */
export const networkHandler = http.all(api('/*'), async ({ request }) => {
  const path = apiRelative(request.url)
  if (path.startsWith('/__mock')) return

  const ms = latencyFor(mockConfig.current.latency, request.method, path)
  if (ms > 0) await delay(ms)

  const fault = matchFault(request.method, path)
  if (!fault) return
  switch (fault.action.type) {
    case 'network-error':
      return HttpResponse.error()
    case 'timeout':
      await delay(60_000)
      return fail('TRANSIENT', 'Tempo de resposta esgotado.', { status: 504 })
    case 'status':
      return fail(
        (fault.action.code as Parameters<typeof fail>[0]) ?? 'INTERNAL',
        fault.action.message ?? 'Falha simulada no servidor.',
        { status: fault.action.status },
      )
  }
})
