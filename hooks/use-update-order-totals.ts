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

import { useCalculateDeliveryFee } from '@/hooks/use-branch-delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import {
  calculateOrderDisplayAndTotals,
  parseKm,
  transformOrderItemToOrderDetail,
} from '@/utils'
import { computeUpdateOrderPayable } from '@/utils/update-order-payable'

export function useUpdateOrderTotals() {
  const draft = useOrderFlowStore((s) => s.updatingData?.updateDraft)

  return useMemo(() => {
    if (!draft) {
      return {
        displayItems: [] as ReturnType<
          typeof calculateOrderDisplayAndTotals
        >['displayItems'],
        cartTotals: null as
          | ReturnType<typeof calculateOrderDisplayAndTotals>['cartTotals']
          | null,
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

/** Tiền phải trả của bản nháp — thanh dưới và sheet xác nhận dùng chung. */
export function useUpdateOrderPayable() {
  const { cartTotals } = useUpdateOrderTotals()
  const type = useOrderFlowStore((s) => s.updatingData?.updateDraft?.type)
  const deliveryDistance = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.deliveryDistance ?? 0,
  )
  const originalDeliveryFee = useOrderFlowStore(
    (s) => s.updatingData?.originalOrder?.deliveryFee ?? 0,
  )
  const pointsUsed = useOrderFlowStore(
    (s) => s.updatingData?.originalOrder?.accumulatedPointsToUse ?? 0,
  )
  // Phí ship tính theo chi nhánh của ĐƠN, không phải chi nhánh đang chọn
  const orderBranch = useOrderFlowStore((s) => {
    const b = s.updatingData?.originalOrder?.branch as
      | string
      | { slug?: string }
      | undefined
    return typeof b === 'string' ? b : b?.slug
  })
  const storeBranch = useBranchStore((s) => s.branch?.slug)
  const userBranch = useUserStore((s) => s.userInfo?.branch?.slug)
  const branchSlug = orderBranch || storeBranch || userBranch || ''

  const isDelivery = type === OrderTypeEnum.DELIVERY
  const { deliveryFee: recalculatedDeliveryFee } = useCalculateDeliveryFee(
    parseKm(deliveryDistance) ?? 0,
    branchSlug,
    { enabled: isDelivery && deliveryDistance > 0 },
  )

  return computeUpdateOrderPayable({
    cartTotals,
    type,
    deliveryDistance,
    recalculatedDeliveryFee,
    originalDeliveryFee,
    pointsUsed,
  })
}
