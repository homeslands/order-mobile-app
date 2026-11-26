/**
 * Tiền giỏ — một nguồn cho thẻ món, thanh dưới, sheet voucher. Dùng chung
 * hàm với sheet xác nhận / thanh toán (calculateCartDisplayAndTotals) nên mọi
 * chỗ ra cùng một số.
 */
import type { IOrderItem, IVoucher } from '@/types'
import { calculateCartDisplayAndTotals } from '@/utils/cart'

export type CartPricing = {
  /** Tổng sau khuyến mãi, trước voucher — để xét điều kiện voucher */
  subtotalAfterPromotion: number
  voucherDiscount: number
  /** Tổng phải trả (chưa gồm phí giao) */
  finalTotal: number
  /** Đơn giá cuối của từng món (sau khuyến mãi / voucher) theo id */
  finalPriceById: Record<string, number>
}

const EMPTY: CartPricing = {
  subtotalAfterPromotion: 0,
  voucherDiscount: 0,
  finalTotal: 0,
  finalPriceById: {},
}

let lastItems: IOrderItem[] | undefined
let lastVoucher: IVoucher | null | undefined
let lastPricing: CartPricing = EMPTY

// Selector gọi hàm này mỗi lần store đổi (cả khi gõ ghi chú) — nhớ kết quả
// theo tham chiếu items + voucher để chỉ tính lại khi giỏ thật sự đổi.
export function getCartPricing(
  items: IOrderItem[] | undefined,
  voucher: IVoucher | null | undefined,
): CartPricing {
  if (!items || items.length === 0) return EMPTY
  if (items === lastItems && voucher === lastVoucher) return lastPricing

  const v = voucher ?? null
  const { displayItems, cartTotals } = calculateCartDisplayAndTotals(
    { orderItems: items, voucher: v },
    v,
  )

  let subtotalAfterPromotion = 0
  const finalPriceById: Record<string, number> = {}
  items.forEach((it, i) => {
    const original = it.originalPrice ?? 0
    const promo =
      it.promotionDiscount ??
      Math.round(original * ((it.promotionValue || 0) / 100))
    const afterPromo = Math.max(0, original - promo)
    subtotalAfterPromotion += afterPromo * (it.quantity || 0)
    finalPriceById[it.id] = displayItems[i]?.finalPrice ?? afterPromo
  })

  lastItems = items
  lastVoucher = voucher
  lastPricing = {
    subtotalAfterPromotion,
    voucherDiscount: cartTotals.voucherDiscount,
    finalTotal: cartTotals.finalTotal,
    finalPriceById,
  }
  return lastPricing
}
