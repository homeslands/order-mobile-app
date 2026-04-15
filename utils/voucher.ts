import { APPLICABILITY_RULE } from '@/constants'

export function isVoucherApplicableToCartItems(
  cartProductSlugs: string[],
  voucherProductSlugs: string[],
  rule: APPLICABILITY_RULE,
): boolean {
  if (voucherProductSlugs.length === 0 || cartProductSlugs.length === 0)
    return false

  if (rule === APPLICABILITY_RULE.ALL_REQUIRED) {
    // All products in cart must be in voucher list
    return cartProductSlugs.every((slug) => voucherProductSlugs.includes(slug))
  }

  if (rule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED) {
    // Only need at least one item in cart to be in voucher list
    return cartProductSlugs.some((slug) => voucherProductSlugs.includes(slug))
  }

  return false
}
