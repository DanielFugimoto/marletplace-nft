import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { editionKindSchema, ethAmount, type NftUpdatedEvent } from '@/api/contracts'
import { db, findEdition, findNft, persist, resetDb } from '../db/store'
import { clearOrderTimers } from '../domain/orders'
import { deliverRaw, dropConnections, nftUpdatedEvent, publishNftUpdated, realtimeStats, replayEvent } from '../realtime'
import { buildConfig, isScenarioId, mockConfig, SCENARIOS, saveConfig, setScenario } from '../scenarios'
import { api, fail, handle, parseBody, raise } from '../utils'
import { resetNetworkCounters } from './network'

/**
 * Control plane for development, demos and Playwright. It only exists inside
 * the mock layer: it mutates the simulated backend, and every visible effect
 * still reaches the app through REST responses or Socket.IO events.
 */

const nftChangeSchema = z.object({
  editionId: editionKindSchema.optional(),
  price: ethAmount.optional(),
  available: z.number().int().min(0).optional(),
})

const faultSchema = z.object({
  method: z.string().default('*'),
  path: z.string().startsWith('/'),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('network-error') }),
    z.object({ type: z.literal('timeout') }),
    z.object({ type: z.literal('status'), status: z.number().int(), code: z.string().optional(), message: z.string().optional() }),
  ]),
  times: z.number().int().min(1).optional(),
})

export const controlHandlers = [
  http.get(api('/__mock/state'), () =>
    HttpResponse.json({
      config: mockConfig.current,
      scenarios: Object.entries(SCENARIOS).map(([id, s]) => ({ id, label: s.label, description: s.description })),
      realtime: realtimeStats(),
    }),
  ),

  http.post(
    api('/__mock/reset'),
    handle(async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { scenario?: string }
      clearOrderTimers()
      resetDb()
      resetNetworkCounters()
      setScenario(isScenarioId(body.scenario) ? body.scenario : 'default')
      return HttpResponse.json({ ok: true, config: mockConfig.current })
    }),
  ),

  http.post(
    api('/__mock/scenario'),
    handle(async ({ request }) => {
      const { scenario } = (await request.json()) as { scenario?: string }
      if (!isScenarioId(scenario)) return fail('VALIDATION_ERROR', `Cenário desconhecido: ${String(scenario)}`)
      resetNetworkCounters()
      saveConfig(buildConfig(scenario))
      return HttpResponse.json({ ok: true, config: mockConfig.current })
    }),
  ),

  http.post(
    api('/__mock/config'),
    handle(async ({ request }) => {
      const patch = (await request.json()) as Partial<typeof mockConfig.current>
      saveConfig({
        ...mockConfig.current,
        ...patch,
        flags: { ...mockConfig.current.flags, ...patch.flags },
      })
      return HttpResponse.json({ ok: true, config: mockConfig.current })
    }),
  ),

  http.post(
    api('/__mock/faults'),
    handle(async ({ request }) => {
      const rule = await parseBody(request, faultSchema)
      saveConfig({ ...mockConfig.current, faults: [...mockConfig.current.faults, rule] })
      return HttpResponse.json({ ok: true, config: mockConfig.current })
    }),
  ),

  http.delete(api('/__mock/faults'), () => {
    saveConfig({ ...mockConfig.current, faults: [] })
    return HttpResponse.json({ ok: true, config: mockConfig.current })
  }),

  /** Changes price/availability in the backend and broadcasts nft.updated. */
  http.post(
    api('/__mock/nfts/:id'),
    handle(async ({ request, params }) => {
      const nft = findNft(String(params.id)) ?? raise('NOT_FOUND', 'NFT não encontrado.')
      const change = await parseBody(request, nftChangeSchema)
      const edition = findEdition(nft, change.editionId ?? nft.defaultEditionId) ?? raise('NOT_FOUND', 'Edição não encontrada.')
      if (change.price !== undefined) edition.price = change.price
      if (change.available !== undefined) edition.available = change.available
      nft.version += 1
      persist()
      return HttpResponse.json(publishNftUpdated(nft))
    }),
  ),

  /** Re-delivers an event that was already sent (duplicate delivery). */
  http.post(
    api('/__mock/events/replay'),
    handle(async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { eventId?: string }
      const event = replayEvent(body.eventId)
      return event ? HttpResponse.json(event) : fail('NOT_FOUND', 'Nenhum evento para reenviar.')
    }),
  ),

  /** Delivers an nft.updated carrying an outdated version and bogus values. */
  http.post(
    api('/__mock/events/stale/:id'),
    handle(({ params }) => {
      const nft = findNft(String(params.id)) ?? raise('NOT_FOUND', 'NFT não encontrado.')
      const current = nftUpdatedEvent(nft)
      const stale: NftUpdatedEvent = {
        ...current,
        version: Math.max(1, nft.version - 1),
        data: { ...current.data, price: '999', editions: current.data.editions.map((e) => ({ ...e, price: '999' })) },
      }
      deliverRaw(stale)
      return HttpResponse.json(stale)
    }),
  ),

  /** Closes every socket and refuses reconnection for the given time. */
  http.post(
    api('/__mock/realtime/drop'),
    handle(async ({ request }) => {
      const { ms = 3_000 } = (await request.json().catch(() => ({}))) as { ms?: number }
      dropConnections(ms)
      return HttpResponse.json({ ok: true })
    }),
  ),

  http.post(api('/__mock/sessions/expire'), () => {
    const past = new Date(Date.now() - 1_000).toISOString()
    db.state.sessions.forEach((s) => (s.expiresAt = past))
    persist()
    return HttpResponse.json({ ok: true })
  }),

  http.post(api('/__mock/wallet-connections/drop'), () => {
    db.state.connections.forEach((c) => (c.active = false))
    persist()
    return HttpResponse.json({ ok: true })
  }),
]
