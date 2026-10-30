import { redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { credentials } from '@/api/credentials'
import { safeRedirect } from '@/lib/form-errors'

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})

/** Signed-in collectors skip the auth screens. */
export function redirectIfAuthenticated({ search }: { search: z.infer<typeof authSearchSchema> }) {
  if (credentials.getSession() && search.reason !== 'expired') {
    throw redirect({ to: safeRedirect(search.redirect), replace: true })
  }
}
