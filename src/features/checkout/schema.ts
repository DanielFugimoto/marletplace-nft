import { z } from 'zod'
import { buyerSchema, networkSchema } from '@/api/contracts'

export const checkoutFormSchema = buyerSchema.extend({
  walletId: z.string().min(1, 'Selecione uma carteira cadastrada'),
  network: networkSchema,
})
export type CheckoutForm = z.infer<typeof checkoutFormSchema>

export const CHECKOUT_FIELDS = [
  'displayName',
  'username',
  'profileName',
  'email',
  'ensName',
  'referralCode',
  'walletAddress',
  'secondaryAddress',
  'walletType',
  'note',
  'walletId',
  'network',
] as const satisfies ReadonlyArray<keyof CheckoutForm>
