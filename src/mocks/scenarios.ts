/**
 * Configurable, reproducible network conditions and business scenarios.
 * The active config is persisted so it survives refreshes, and can be chosen
 * with `?mock=<scenario>` on any URL or through the control endpoints.
 */

export type Latency =
  | { kind: 'none' }
  | { kind: 'fixed'; ms: number }
  /** Deterministic pseudo-random latency between min and max. */
  | { kind: 'variable'; min: number; max: number }
  /** Successive catalog queries resolve in reverse order (1.5s, 0.9s, 0.3s, ...). */
  | { kind: 'out-of-order' }

export type FaultAction =
  | { type: 'network-error' }
  | { type: 'timeout' }
  | { type: 'status'; status: number; code?: string; message?: string }

export interface FaultRule {
  /** HTTP method, or '*' for any. */
  method: string
  /** Path prefix relative to the API base, e.g. "/me/favorites". */
  path: string
  action: FaultAction
  /** How many matching requests fail; omitted means all of them. */
  times?: number
}

export interface MockFlags {
  sessionTtlMs: number
  orderResolveMs: number
  orderOutcome: 'confirm' | 'reject'
  /** First POST /orders for a key is created but its response never arrives in time. */
  orderTimeoutOnce: boolean
  /** Price of the first cart item rises right before the order is placed. */
  priceChangeOnCheckout: boolean
  /** Edition of the first cart item sells out right before the order is placed. */
  soldOutOnCheckout: boolean
  walletRejects: boolean
  emptyCatalog: boolean
}

export interface MockConfig {
  scenario: ScenarioId
  latency: Latency
  faults: FaultRule[]
  flags: MockFlags
}

export const DEFAULT_FLAGS: MockFlags = {
  sessionTtlMs: 2 * 60 * 60_000,
  orderResolveMs: 2_500,
  orderOutcome: 'confirm',
  orderTimeoutOnce: false,
  priceChangeOnCheckout: false,
  soldOutOnCheckout: false,
  walletRejects: false,
  emptyCatalog: false,
}

/** Small latency by default so loading states are observable but quick. */
const BASE_LATENCY: Latency = { kind: 'variable', min: 120, max: 350 }

interface ScenarioDef {
  label: string
  description: string
  latency?: Latency
  faults?: FaultRule[]
  flags?: Partial<MockFlags>
}

export const SCENARIOS = {
  default: { label: 'Padrão', description: 'Sucesso com latência curta.' },
  empty: { label: 'Catálogo vazio', description: 'Listagem de NFTs sem resultados.', flags: { emptyCatalog: true } },
  slow: { label: 'Rede lenta', description: 'Todas as respostas levam ~2,5s.', latency: { kind: 'fixed', ms: 2_500 } },
  'variable-latency': {
    label: 'Latência variável',
    description: 'Respostas entre 200ms e 3s.',
    latency: { kind: 'variable', min: 200, max: 3_000 },
  },
  'out-of-order': {
    label: 'Respostas fora de ordem',
    description: 'Consultas do catálogo mais recentes respondem antes das antigas.',
    latency: { kind: 'out-of-order' },
  },
  offline: {
    label: 'Sem conexão',
    description: 'Todas as chamadas REST falham com erro de rede.',
    faults: [{ method: '*', path: '/', action: { type: 'network-error' } }],
  },
  'server-error': {
    label: 'Erro 500 no catálogo',
    description: 'Listagem e detalhe de NFTs respondem 500.',
    faults: [{ method: 'GET', path: '/nfts', action: { type: 'status', status: 500, code: 'INTERNAL' } }],
  },
  'flaky-catalog': {
    label: 'Falha transitória',
    description: 'As 3 primeiras consultas do catálogo respondem 503; depois normaliza.',
    faults: [{ method: 'GET', path: '/nfts', action: { type: 'status', status: 503, code: 'TRANSIENT' }, times: 3 }],
  },
  'session-expired': {
    label: 'Sessão curta',
    description: 'Sessões expiram 60s após o login.',
    flags: { sessionTtlMs: 60_000 },
  },
  'favorites-failure': {
    label: 'Falha em favoritos',
    description: 'Incluir/remover favorito responde 500.',
    faults: [{ method: '*', path: '/me/favorites/', action: { type: 'status', status: 500, code: 'INTERNAL' } }],
  },
  'price-change-checkout': {
    label: 'Preço alterado na compra',
    description: 'O preço do primeiro item sobe no momento da confirmação.',
    flags: { priceChangeOnCheckout: true },
  },
  'sold-out-checkout': {
    label: 'Edição esgotada na compra',
    description: 'A edição do primeiro item esgota no momento da confirmação.',
    flags: { soldOutOnCheckout: true },
  },
  'order-timeout': {
    label: 'Timeout do pedido',
    description: 'O pedido é criado mas a resposta não chega; nova tentativa recupera o mesmo pedido.',
    flags: { orderTimeoutOnce: true },
  },
  'payment-declined': {
    label: 'Pagamento recusado',
    description: 'Pedidos ficam pendentes e então são recusados.',
    flags: { orderOutcome: 'reject' },
  },
  'wallet-rejected': {
    label: 'Carteira recusa conexão',
    description: 'A carteira recusa o pedido de conexão.',
    flags: { walletRejects: true },
  },
} satisfies Record<string, ScenarioDef>

export type ScenarioId = keyof typeof SCENARIOS
export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[]
export const isScenarioId = (v: unknown): v is ScenarioId => typeof v === 'string' && v in SCENARIOS

export function buildConfig(id: ScenarioId): MockConfig {
  const def: ScenarioDef = SCENARIOS[id]
  return {
    scenario: id,
    latency: def.latency ?? BASE_LATENCY,
    faults: structuredClone(def.faults ?? []),
    flags: { ...DEFAULT_FLAGS, ...def.flags },
  }
}

const CONFIG_KEY = 'kurio:mock:config:v1'

function loadConfig(): MockConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockConfig
      if (isScenarioId(parsed.scenario)) return parsed
    }
  } catch {
    // ignore
  }
  return buildConfig('default')
}

export const mockConfig: { current: MockConfig } = { current: loadConfig() }

export function saveConfig(next: MockConfig) {
  mockConfig.current = next
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function setScenario(id: ScenarioId) {
  saveConfig(buildConfig(id))
}
