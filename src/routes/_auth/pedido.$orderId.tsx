import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/checkout/order-page'

export const Route = createFileRoute('/_auth/pedido/$orderId')({
  staticData: { hideFooter: true },
  component: OrderRoute,
})

function OrderRoute() {
  const { orderId } = Route.useParams()
  return <OrderPage key={orderId} orderId={orderId} />
}
