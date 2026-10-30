import { toast } from 'sonner'
import type { EditionKind } from '@/api/contracts'
import { errorMessage } from '@/components/states'
import { useAddToCart } from './queries'

/** Add-to-cart with accessible feedback for success, limits and sold-out editions. */
export function useAddToCartAction() {
  const add = useAddToCart()
  const addItem = (input: { nftId: string; name: string; editionId: EditionKind; editionLabel: string; quantity: number }) =>
    add.mutateAsync(
      { nftId: input.nftId, editionId: input.editionId, quantity: input.quantity },
      {
        onSuccess: () =>
          toast.success(`${input.name} adicionado ao carrinho`, {
            id: `cart-${input.nftId}`,
            description: `${input.quantity} × edição ${input.editionLabel}`,
          }),
        onError: (error) =>
          toast.error('Não foi possível adicionar ao carrinho', {
            id: `cart-${input.nftId}`,
            description: errorMessage(error),
          }),
      },
    )
  return { addItem, isPending: add.isPending }
}
