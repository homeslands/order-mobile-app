/**
 * Tiền phải trả khi sửa đơn — một chỗ tính cho thanh dưới và sheet xác nhận
 * (trước mỗi chỗ tự cộng phí ship / điểm nên ra hai số).
 */
import { OrderTypeEnum } from '@/types'

export function computeUpdateOrderPayable({
  cartTotals,
  type,
  deliveryDistance,
  recalculatedDeliveryFee,
  originalDeliveryFee,
  pointsUsed,
}: {
  cartTotals: {
    subTotalBeforeDiscount: number
    promotionDiscount: number
    voucherDiscount: number
    finalTotal: number
  } | null
  type: string | undefined
  deliveryDistance: number
  recalculatedDeliveryFee: number | undefined
  originalDeliveryFee: number
  pointsUsed: number
}) {
  // Không phải giao hàng thì không có phí ship, kể cả đơn gốc là giao hàng
  const deliveryFee =
    type !== OrderTypeEnum.DELIVERY
      ? 0
      : deliveryDistance > 0
        ? (recalculatedDeliveryFee ?? originalDeliveryFee)
        : originalDeliveryFee

  const subTotal = cartTotals?.subTotalBeforeDiscount ?? 0
  const promotionDiscount = cartTotals?.promotionDiscount ?? 0
  const voucherDiscount = cartTotals?.voucherDiscount ?? 0
  const itemsTotal = cartTotals?.finalTotal ?? 0

  return {
    deliveryFee,
    voucherDiscount,
    /** Tổng sau khuyến mãi, trước voucher — giá gạch ngang khi có voucher */
    totalBeforeVoucher: subTotal - promotionDiscount + deliveryFee - pointsUsed,
    finalTotal: itemsTotal + deliveryFee - pointsUsed,
  }
}
