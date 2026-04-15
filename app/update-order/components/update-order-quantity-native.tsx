import { IOrderItem } from '@/types'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { useOrderFlowStore } from '@/stores'
import { QuantitySelector } from '@/components/button'

interface UpdateOrderQuantityNativeProps {
  orderItem: IOrderItem
}

export default function UpdateOrderQuantityNative({
  orderItem,
}: UpdateOrderQuantityNativeProps) {
  const updateDraftItemQuantity = useOrderFlowStore((s) => s.updateDraftItemQuantity)

  const handleChange = (newQuantity: number) => {
    scheduleStoreUpdate(() => updateDraftItemQuantity(orderItem.id!, newQuantity))
  }

  return (
    <QuantitySelector
      value={orderItem.quantity}
      onChange={handleChange}
      min={1}
    />
  )
}
