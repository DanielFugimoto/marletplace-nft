import { z } from 'zod'

const schema = z.object({
  VITE_ENABLE_MOCKS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  VITE_API_URL: z.string().min(1).default('/api'),
  VITE_SOCKET_URL: z.string().default(''),
})

const parsed = schema.parse(import.meta.env)

export const env = {
  enableMocks: parsed.VITE_ENABLE_MOCKS,
  apiUrl: parsed.VITE_API_URL,
  /** Empty means same origin as the app. */
  socketUrl: parsed.VITE_SOCKET_URL || window.location.origin,
} as const
