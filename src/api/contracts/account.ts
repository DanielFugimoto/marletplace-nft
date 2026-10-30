import { z } from 'zod'
import { emailSchema, newPasswordSchema, usernameSchema } from './auth'
import { id, isoDate, networkSchema, walletProviderSchema } from './common'

const required = (label: string) => z.string().trim().min(1, `Informe ${label}`)

export const ensNameSchema = z
  .string()
  .trim()
  .max(40, 'Use no máximo 40 caracteres')
  .regex(/^[a-z0-9-]*$/i, 'Use letras, números e hífen')

export const profileSchema = z.object({
  id,
  username: z.string(),
  displayName: z.string(),
  email: z.email(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
  updatedAt: isoDate,
})
export type Profile = z.infer<typeof profileSchema>

export const updateProfileSchema = z.object({
  displayName: required('o nome de exibição').max(60, 'Use no máximo 60 caracteres'),
  username: usernameSchema,
  email: emailSchema,
  ensName: ensNameSchema.min(1, 'Informe o nome ENS'),
  walletNickname: required('o apelido da carteira').max(40, 'Use no máximo 40 caracteres'),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>

export const MAX_AVATAR_BYTES = 512 * 1024
export const updateAvatarSchema = z.object({
  /** data: URL of a PNG/JPEG/WebP image, max 512 KB once decoded. */
  dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/, 'Envie uma imagem PNG, JPG ou WebP'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>

export const WALLET_SLOTS = ['primary', 'secondary'] as const
export const walletSlotSchema = z.enum(WALLET_SLOTS)
export type WalletSlot = z.infer<typeof walletSlotSchema>

export const walletAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais')

export const walletSchema = z.object({
  id,
  slot: walletSlotSchema,
  displayName: z.string(),
  nickname: z.string(),
  network: networkSchema,
  profileName: z.string(),
  address: z.string(),
  secondaryAddress: z.string(),
  provider: walletProviderSchema,
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  updatedAt: isoDate,
})
export type Wallet = z.infer<typeof walletSchema>

export const walletInputSchema = z.object({
  displayName: required('o nome de exibição').max(60),
  nickname: required('o apelido da carteira').max(40),
  network: networkSchema,
  profileName: required('o nome do perfil').max(60),
  address: walletAddressSchema,
  secondaryAddress: z
    .string()
    .trim()
    .refine((v) => v === '' || /^0x[a-fA-F0-9]{40}$/.test(v) || /^[a-z0-9-]+\.eth$/i.test(v), {
      message: 'Informe um endereço 0x ou um nome .eth',
    }),
  provider: walletProviderSchema,
  referralCode: required('o código de indicação').regex(/^[A-Z0-9-]{4,16}$/i, 'Código de indicação inválido'),
  email: emailSchema,
  ensName: ensNameSchema.min(1, 'Informe o nome ENS'),
})
export type WalletInput = z.infer<typeof walletInputSchema>

export const createWalletSchema = walletInputSchema.extend({ slot: walletSlotSchema })
export type CreateWalletRequest = z.infer<typeof createWalletSchema>

export const walletConnectionSchema = z.object({
  id,
  walletId: id,
  provider: walletProviderSchema,
  network: networkSchema,
  address: z.string(),
  connectedAt: isoDate,
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>

export const connectWalletSchema = z.object({ walletId: id, network: networkSchema })
