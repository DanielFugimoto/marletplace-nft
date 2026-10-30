import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { profileApi, walletApi } from '@/api/client'
import type {
  ChangePasswordRequest,
  CreateWalletRequest,
  Network,
  Profile,
  UpdateProfileRequest,
  Wallet,
  WalletInput,
} from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'
import { useSession } from '@/features/auth/session'

function useUserId() {
  const { user } = useSession()
  return user?.id ?? null
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'anonymous'),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: Boolean(userId),
  })
}

function useProfileMutation<V>(fn: (vars: V) => Promise<Profile>) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: fn,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile(profile.id), profile)
      // Name/avatar also appear in the session user (header).
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.wallets(userId) })
    },
  })
}

export const useUpdateProfile = () => useProfileMutation((body: UpdateProfileRequest) => profileApi.update(body))
export const useUpdateAvatar = () => useProfileMutation((dataUrl: string) => profileApi.updateAvatar(dataUrl))
export const useRemoveAvatar = () => useProfileMutation(() => profileApi.removeAvatar())

export function useChangePassword() {
  return useMutation({ mutationFn: (body: ChangePasswordRequest) => profileApi.changePassword(body) })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.wallets(userId ?? 'anonymous'),
    queryFn: ({ signal }) => walletApi.list({ signal }),
    enabled: Boolean(userId),
  })
}

function useWalletMutation<V>(fn: (vars: V) => Promise<Wallet>) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: fn,
    onSuccess: (wallet) => {
      if (!userId) return
      queryClient.setQueryData<Wallet[]>(queryKeys.wallets(userId), (list = []) =>
        list.some((w) => w.id === wallet.id) ? list.map((w) => (w.id === wallet.id ? wallet : w)) : [...list, wallet],
      )
    },
  })
}

export const useCreateWallet = () => useWalletMutation((body: CreateWalletRequest) => walletApi.create(body))
export const useUpdateWallet = () =>
  useWalletMutation(({ id, body }: { id: string; body: WalletInput }) => walletApi.update(id, body))

export function useConnectWallet() {
  return useMutation({
    mutationFn: ({ walletId, network }: { walletId: string; network: Network }) => walletApi.connect(walletId, network),
  })
}

export function useDisconnectWallet() {
  return useMutation({ mutationFn: (connectionId: string) => walletApi.disconnect(connectionId) })
}
