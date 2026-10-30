import { useCallback } from 'react'
import { toast } from 'sonner'
import { formatEth } from '@/lib/money'
import type { RealtimeNotice } from './client'
import { useRealtimeNotices } from './RealtimeBridge'

/**
 * Turns realtime changes that matter to the collector into toasts. Sonner
 * renders them in an aria-live region, so screen readers hear them too.
 */
export function RealtimeAnnouncer() {
  const onNotice = useCallback((notice: RealtimeNotice) => {
    if (notice.kind === 'nft-changed' && notice.inCart) {
      if (notice.soldOut) {
        toast.warning(`${notice.name} esgotou`, {
          id: `nft-${notice.nftId}`,
          description: 'Revise seu carrinho antes de finalizar a compra.',
        })
      } else if (notice.priceChanged && notice.previousPrice) {
        toast.warning(`Preço de ${notice.name} atualizado`, {
          id: `nft-${notice.nftId}`,
          description: `De ${formatEth(notice.previousPrice)} para ${formatEth(notice.price)}. O resumo do carrinho foi recalculado.`,
        })
      } else {
        toast.info(`Disponibilidade de ${notice.name} atualizada`, { id: `nft-${notice.nftId}` })
      }
    }
    if (notice.kind === 'reconnected') {
      toast.success('Conexão restabelecida', { id: 'realtime-reconnected', description: 'Dados atualizados com o servidor.' })
    }
  }, [])
  useRealtimeNotices(onNotice)
  return null
}
