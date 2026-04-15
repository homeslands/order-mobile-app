import { APPLICABILITY_RULE } from '@/constants'
import { ICartItem, IOrderDetail, IVoucher } from '@/types'

export function sumBy<T>(arr: T[], fn: (item: T) => number): number {
  return arr.reduce((sum, item) => sum + fn(item), 0)
}

/** Set lookup O(1) thay vì Array.includes O(m) — giảm isVoucherApplicable từ O(n*m) xuống O(n+m) */
export function getRequiredSlugsSet(voucher: IVoucher): Set<string> {
  const slugs =
    voucher.voucherProducts?.map((vp) => vp.product?.slug ?? '') ?? []
  return new Set(slugs.filter(Boolean))
}

export function checkMinOrderValue(
  cartItems: ICartItem,
  voucher: IVoucher,
): boolean {
  if (!voucher.minOrderValue || voucher.minOrderValue <= 0) return true

  const subtotalBeforeVoucher = cartItems.orderItems.reduce((acc, item) => {
    const original = item.originalPrice ?? 0
    const promotionDiscount = item.promotionDiscount ?? 0
    return acc + (original - promotionDiscount) * item.quantity
  }, 0)

  return subtotalBeforeVoucher >= voucher.minOrderValue
}

export function isVoucherApplicable(
  cartItems: ICartItem,
  voucher: IVoucher,
): boolean {
  if (!cartItems?.orderItems || cartItems.orderItems.length === 0) {
    return false
  }

  const requiredSlugsSet = getRequiredSlugsSet(voucher)

  if (requiredSlugsSet.size === 0) {
    return checkMinOrderValue(cartItems, voucher)
  }

  const orderItems = cartItems.orderItems

  if (voucher.applicabilityRule === APPLICABILITY_RULE.ALL_REQUIRED) {
    const allInVoucher = orderItems.every((item) =>
      requiredSlugsSet.has(item.slug ?? ''),
    )
    if (!allInVoucher) return false
  }

  if (voucher.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED) {
    const hasAtLeastOne = orderItems.some((item) =>
      requiredSlugsSet.has(item.slug ?? ''),
    )
    if (!hasAtLeastOne) return false
  }

  return checkMinOrderValue(cartItems, voucher)
}

export function isVoucherApplicableFromOrderDetails(
  orderItems: IOrderDetail[],
  voucher: IVoucher,
): boolean {
  if (!orderItems || orderItems.length === 0) return false

  const requiredSlugsSet = getRequiredSlugsSet(voucher)

  if (requiredSlugsSet.size === 0) {
    return true
  }

  if (voucher.applicabilityRule === APPLICABILITY_RULE.ALL_REQUIRED) {
    return orderItems.every((item) =>
      requiredSlugsSet.has(item.variant?.product?.slug ?? ''),
    )
  }

  if (voucher.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED) {
    return orderItems.some((item) =>
      requiredSlugsSet.has(item.variant?.product?.slug ?? ''),
    )
  }
  return false
}
