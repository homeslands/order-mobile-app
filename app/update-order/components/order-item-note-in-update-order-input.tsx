import { useCallback } from 'react'

import { CartNoteInput } from '@/components/input'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem } from '@/types'

interface OrderItemNoteInUpdateOrderInputProps {
  orderItem: IOrderItem
}

export default function OrderItemNoteInUpdateOrderInput({
  orderItem,
}: OrderItemNoteInUpdateOrderInputProps) {
  const addDraftNote = useOrderFlowStore((s) => s.addDraftNote)

  const handleChange = useCallback(
    (text: string) => {
      scheduleStoreUpdate(() => addDraftNote(orderItem.id!, text))
    },
    [orderItem.id, addDraftNote],
  )

  return <CartNoteInput value={orderItem.note || ''} onChange={handleChange} />
}
