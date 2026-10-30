import { z } from 'zod'
import { id, isoDate } from './common'

export const userSchema = z.object({
  id,
  username: z.string(),
  displayName: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: isoDate,
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>

export const loginResponseSchema = sessionSchema.extend({
  /** True when a guest cart (X-Cart-Id) was merged into the user's cart. */
  cartMerged: z.boolean(),
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

const password = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use ao menos 3 caracteres')
  .max(30, 'Use no máximo 30 caracteres')
  .regex(/^[a-z0-9._]+$/i, 'Use apenas letras, números, ponto e sublinhado')

export const emailSchema = z.string().trim().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido'))

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const registerRequestSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const newPasswordSchema = password
