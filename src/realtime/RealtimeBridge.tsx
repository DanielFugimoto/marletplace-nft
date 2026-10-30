import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { useToken } from '@/features/auth/session'
import { realtime, type RealtimeNotice } from './client'

/** Owns the socket lifecycle: one connection per session token. */
export function RealtimeBridge() {
  const queryClient = useQueryClient()
  const token = useToken()

  useEffect(() => {
    realtime.connect(queryClient, token)
    return () => realtime.disconnect()
  }, [queryClient, token])

  return null
}

export function useRealtimeStatus() {
  return useSyncExternalStore(realtime.subscribeStatus, realtime.getStatus, realtime.getStatus)
}

export function useRealtimeNotices(listener: (notice: RealtimeNotice) => void) {
  useEffect(() => realtime.subscribeNotices(listener), [listener])
}
