import { useEffect } from 'react'
import type { UseFormWatch } from 'react-hook-form'
import type { CheckoutForm } from './schema'

const key = (userId: string) => `kurio:checkout-draft:${userId}`

/** The form draft survives a session expiry + re-login so the collector can resume. */
export const checkoutDraft = {
  load(userId: string): Partial<CheckoutForm> | null {
    try {
      const raw = sessionStorage.getItem(key(userId))
      return raw ? (JSON.parse(raw) as Partial<CheckoutForm>) : null
    } catch {
      return null
    }
  },
  save(userId: string, value: Partial<CheckoutForm>) {
    try {
      sessionStorage.setItem(key(userId), JSON.stringify(value))
    } catch {
      // ignore
    }
  },
  clear(userId: string) {
    try {
      sessionStorage.removeItem(key(userId))
    } catch {
      // ignore
    }
  },
}

export function usePersistDraft(userId: string, watch: UseFormWatch<CheckoutForm>) {
  useEffect(() => {
    const sub = watch((value) => checkoutDraft.save(userId, value as Partial<CheckoutForm>))
    return () => sub.unsubscribe()
  }, [userId, watch])
}
