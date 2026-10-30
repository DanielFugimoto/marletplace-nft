/**
 * localStorage access that never throws (private mode, blocked storage).
 */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? null : (JSON.parse(raw) as T)
    } catch {
      return null
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable: state simply won't survive a refresh.
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

export const STORAGE_KEYS = {
  session: 'kurio:session',
  guestCartId: 'kurio:guest-cart-id',
  pendingOrder: 'kurio:pending-order',
  checkoutAttempt: 'kurio:checkout-attempt',
} as const
