import { STORAGE_KEYS, storage } from '@/lib/storage'

/**
 * Persisted transport credentials. Only the opaque session token and the
 * guest cart id live here; user data always comes from the API.
 */
export interface StoredSession {
  token: string
  userId: string
  expiresAt: string
}

type Listener = () => void
const listeners = new Set<Listener>()
const notify = () => listeners.forEach((l) => l())

let session = storage.get<StoredSession>(STORAGE_KEYS.session)
let guestCartId = storage.get<string>(STORAGE_KEYS.guestCartId)

// Keep tabs in sync: logging out in one tab signs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEYS.session) {
      session = storage.get<StoredSession>(STORAGE_KEYS.session)
      notify()
    } else if (event.key === STORAGE_KEYS.guestCartId) {
      guestCartId = storage.get<string>(STORAGE_KEYS.guestCartId)
      notify()
    }
  })
}

export const credentials = {
  getSession: () => session,
  setSession(next: StoredSession | null) {
    session = next
    if (next) storage.set(STORAGE_KEYS.session, next)
    else storage.remove(STORAGE_KEYS.session)
    notify()
  },
  getGuestCartId: () => guestCartId,
  setGuestCartId(id: string | null) {
    if (id === guestCartId) return
    guestCartId = id
    if (id) storage.set(STORAGE_KEYS.guestCartId, id)
    else storage.remove(STORAGE_KEYS.guestCartId)
    notify()
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
