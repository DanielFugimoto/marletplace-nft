import { toast } from 'sonner'

/**
 * Feedback for layout actions that are outside the challenge scope
 * (social login, newsletter, editorial pages...). They must never look like
 * they succeeded.
 */
export function notifyUnavailable(feature: string) {
  toast.info(`${feature} não está disponível nesta versão.`, {
    id: `unavailable-${feature}`,
    description: 'Esta ação faz parte do layout, mas está fora do escopo da demonstração.',
  })
}
