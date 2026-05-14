/**
 * useUpdateOrderTotals — single source of truth cho display items + totals của
 * update-order draft.
 *
 * 4 component (content-native, footer, confirm-dialog, voucher-sheet) trước đây
 * tự gọi calculateOrderDisplayAndTotals(transformOrderItemToOrderDetail(...)),
 * mỗi cái re-run mỗi lần draft đổi. Hook này gom lại 1 memo theo `draft` ref
 * — vẫn rẻ về cache miss (Zustand giữ stable reference khi không đổi).
 */
import { useMemo } from 'react'

import { useOrderFlowStore } from '@/stores'
import {
  calculateOrderDisplayAndTotals,
  transformOrderItemToOrderDetail,
} from '@/utils'

export function useUpdateOrderTotals() {
  const draft = useOrderFlowStore((s) => s.updatingData?.updateDraft)

  return useMemo(() => {
    if (!draft) {
      return {
        displayItems: [] as ReturnType<
          typeof calculateOrderDisplayAndTotals
        >['displayItems'],
        cartTotals: null as ReturnType<
          typeof calculateOrderDisplayAndTotals
        >['cartTotals'] | null,
        transformedItems: [] as ReturnType<
          typeof transformOrderItemToOrderDetail
        >,
      }
    }
    const transformedItems = transformOrderItemToOrderDetail(
      draft.orderItems ?? [],
    )
    const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
      transformedItems,
      draft.voucher ?? null,
    )
    return { displayItems, cartTotals, transformedItems }
  }, [draft])
}
