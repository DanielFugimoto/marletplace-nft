import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/client'
import type { LoginRequest, RegisterRequest } from '@/api/contracts'
import { endSession, establishSession } from './session'

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (response) => establishSession(queryClient, response),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (response) => establishSession(queryClient, response),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } catch {
        // Logging out locally must always succeed, even offline.
      }
    },
    onSettled: () => endSession(queryClient),
  })
}
