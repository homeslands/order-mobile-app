import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { ICartItem, IDisplayCartItem, IVoucher } from '@/types'

import {
  getRequiredSlugsSet,
  isVoucherApplicable,
} from './cart-voucher.helpers'

const CART_DISPLAY_CACHE_MAX = 5
const displayCache = new Map<string, IDisplayCartItem[]>()

function getCartDisplayCacheKey(
  cartItems: ICartItem | null,
  voucher: IVoucher | null,
): string {
  if (!cartItems?.orderItems?.length) return 'empty'
  const itemsKey = cartItems.orderItems
    .map(
      (o) =>
        `${o.id}:${o.quantity}:${o.originalPrice}:${o.promotionValue ?? ''}:${o.slug ?? ''}`,
    )
    .join('|')
  const vKey = voucher
    ? `${voucher.slug ?? ''}:${voucher.type}:${voucher.value}:${voucher.applicabilityRule}:${voucher.minOrderValue ?? ''}:${(voucher.voucherProducts ?? []).map((vp) => vp.product?.slug ?? '').join(',')}`
    : 'null'
  return `${itemsKey}::${vKey}`
}

export function calculateCartItemDisplay(
  cartItems: ICartItem | null,
  voucher: IVoucher | null,
): IDisplayCartItem[] {
  if (!cartItems || !cartItems.orderItems) return []

  const key = getCartDisplayCacheKey(cartItems, voucher)
  const cached = displayCache.get(key)
  if (cached) return cached

  const isVoucherValid = voucher
    ? isVoucherApplicable(cartItems, voucher)
    : false
  const rule = voucher?.applicabilityRule
  const type = voucher?.type
  const orderItems = cartItems.orderItems

  // Precompute Set O(m) — tránh O(n*m) khi gọi .some() cho từng item
  const eligibleSlugsSet = voucher
    ? getRequiredSlugsSet(voucher)
    : (new Set() as Set<string>)

  const result = orderItems.map((item) => {
    const original = item.originalPrice ?? 0

    const promotionDiscount =
      item.promotionDiscount ??
      Math.round(original * ((item.promotionValue || 0) / 100))

    const priceAfterPromotion = Math.max(0, original - promotionDiscount)
    const isEligible = eligibleSlugsSet.has(item.slug ?? '')

    // ===== Không có hoặc voucher không hợp lệ =====
    if (!isVoucherValid || !voucher) {
      return {
        ...item,
        finalPrice: priceAfterPromotion,
        priceAfterPromotion,
        promotionDiscount,
        voucherDiscount: 0,
      }
    }

    // ===== RULE: ALL_REQUIRED =====
    if (rule === APPLICABILITY_RULE.ALL_REQUIRED) {
      if (type === VOUCHER_TYPE.PERCENT_ORDER && isEligible) {
        return {
          ...item,
          finalPrice: priceAfterPromotion,
          priceAfterPromotion,
          promotionDiscount,
          voucherDiscount: 0,
        }
      }

      if (type === VOUCHER_TYPE.FIXED_VALUE && isEligible) {
        return {
          ...item,
          finalPrice: priceAfterPromotion,
          priceAfterPromotion,
          promotionDiscount,
          voucherDiscount: 0,
        }
      }

      if (type === VOUCHER_TYPE.SAME_PRICE_PRODUCT && isEligible) {
        const newPrice =
          (voucher.value || 0) <= 1
            ? Math.round(original * (1 - (voucher.value || 0)))
            : Math.min(original, voucher.value || 0)
        const voucherDiscount = original - newPrice
        return {
          ...item,
          finalPrice: newPrice,
          priceAfterPromotion,
          promotionDiscount: 0,
          voucherDiscount,
        }
      }
    }

    // ===== RULE: AT_LEAST_ONE_REQUIRED =====
    if (rule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED) {
      if (!isEligible) {
        return {
          ...item,
          finalPrice: priceAfterPromotion,
          priceAfterPromotion,
          promotionDiscount,
          voucherDiscount: 0,
        }
      }

      if (type === VOUCHER_TYPE.PERCENT_ORDER) {
        const voucherDiscount = Math.round(
          ((voucher.value || 0) / 100) * original,
        )
        const finalPrice = Math.max(0, original - voucherDiscount)
        return {
          ...item,
          finalPrice,
          priceAfterPromotion: original,
          promotionDiscount: 0,
          voucherDiscount,
        }
      }

      if (type === VOUCHER_TYPE.FIXED_VALUE) {
        const voucherDiscount = Math.min(original, voucher.value || 0)
        const finalPrice = Math.max(0, original - voucherDiscount)
        return {
          ...item,
          finalPrice,
          priceAfterPromotion: original,
          promotionDiscount: 0,
          voucherDiscount,
        }
      }

      if (type === VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
        const newPrice =
          (voucher.value || 0) <= 1
            ? Math.round(original * (1 - (voucher.value || 0)))
            : Math.min(original, voucher.value || 0)
        const voucherDiscount = original - newPrice
        return {
          ...item,
          finalPrice: newPrice,
          priceAfterPromotion: original,
          promotionDiscount: 0,
          voucherDiscount,
        }
      }
    }

    // ===== Mặc định =====
    return {
      ...item,
      finalPrice: priceAfterPromotion,
      priceAfterPromotion,
      promotionDiscount,
      voucherDiscount: 0,
    }
  })

  if (displayCache.size >= CART_DISPLAY_CACHE_MAX) {
    const firstKey = displayCache.keys().next().value
    if (firstKey) displayCache.delete(firstKey)
  }
  displayCache.set(key, result)
  return result
}
