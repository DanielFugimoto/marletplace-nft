import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { controlHandlers } from './handlers/control'
import { networkHandler } from './handlers/network'
import { orderHandlers } from './handlers/orders'
import { realtimeHandler } from './realtime'

export const handlers = [
  // Runs first for every API request: latency and fault injection.
  networkHandler,
  ...controlHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  realtimeHandler,
]
