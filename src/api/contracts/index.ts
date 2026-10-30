import { z } from 'zod'

export * from './account'
export * from './auth'
export * from './cart'
export * from './common'
export * from './events'
export * from './nft'
export * from './order'

export const favoritesSchema = z.object({ nftIds: z.array(z.string()) })
export type Favorites = z.infer<typeof favoritesSchema>
