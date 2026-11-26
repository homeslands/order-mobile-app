/**
 * Tổng tiền bản nháp sửa đơn — danh sách món, thanh dưới, sheet xác nhận,
 * sheet voucher dùng chung một kết quả (utils/update-order-totals.ts).
 */
import { useCalculateDeliveryFee } from '@/hooks/use-branch-delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { parseKm } from '@/utils'
import { getUpdateOrderTotals } from '@/utils/update-order-totals'
import { computeUpdateOrderPayable } from '@/utils/update-order-payable'

export function useUpdateOrderTotals() {
  // Chỉ theo dõi món + voucher — đổi ghi chú / loại đơn / bàn không tính lại
  const orderItems = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.orderItems,
  )
  const voucher = useOrderFlowStore((s) => s.updatingData?.updateDraft?.voucher)
  return getUpdateOrderTotals(orderItems, voucher)
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
