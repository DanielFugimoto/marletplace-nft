import { z } from 'zod'
import { ethAmount, id, isoDate } from './common'
import { editionKindSchema } from './nft'
import { orderStatusSchema } from './order'

/**
 * Envelope shared by every realtime event. `id` is unique per event (used to
 * drop duplicates) and `version` is the resource version after the change
 * (used to drop stale events).
 */
const envelope = <T extends string, R extends string, D extends z.ZodType>(type: T, resource: R, data: D) =>
  z.object({
    id,
    type: z.literal(type),
    resource: z.object({ type: z.literal(resource), id }),
    version: z.number().int().min(1),
    occurredAt: isoDate,
    data,
  })

export const nftUpdatedEventSchema = envelope(
  'nft.updated',
  'nft',
  z.object({
    price: ethAmount,
    compareAtPrice: ethAmount.nullable(),
    soldOut: z.boolean(),
    editions: z.array(z.object({ id: editionKindSchema, price: ethAmount, available: z.number().int().min(0) })),
  }),
)
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = envelope(
  'order.updated',
  'order',
  z.object({
    userId: id,
    status: orderStatusSchema,
    transactionHash: z.string().nullable(),
    failureReason: z.string().nullable(),
  }),
)
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export const REALTIME_EVENTS = ['nft.updated', 'order.updated'] as const
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent
