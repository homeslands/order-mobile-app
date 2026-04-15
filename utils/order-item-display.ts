import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { IDisplayOrderItem, IOrderDetail, IVoucher } from '@/types'

import {
  getRequiredSlugsSet,
  isVoucherApplicableFromOrderDetails,
} from './cart-voucher.helpers'

export function calculateOrderItemDisplay(
  orderItems: IOrderDetail[],
  voucher: IVoucher | null,
): IDisplayOrderItem[] {
  if (!orderItems || orderItems.length === 0) return []

  const eligibleSlugsSet = voucher
    ? getRequiredSlugsSet(voucher)
    : new Set<string>()

  const isVoucherValid = voucher
    ? isVoucherApplicableFromOrderDetails(orderItems, voucher)
    : false
  const rule = voucher?.applicabilityRule
  const type = voucher?.type

  return orderItems.map((item) => {
    const original = item.variant?.price ?? 0
    const productSlug = item?.variant?.product?.slug ?? ''
    const name = item.variant?.product?.name ?? ''

    // ===== PROMOTION =====
    let promotionDiscount = 0
    if (item.promotion?.type === 'per-product') {
      const promotionValue = item.promotion?.value || 0
      promotionDiscount = Math.round(original * (promotionValue / 100))
    }

    const priceAfterPromotion = Math.max(0, original - promotionDiscount)
    const isEligible = eligibleSlugsSet.has(productSlug)

    let finalPrice = priceAfterPromotion
    let voucherDiscount = 0

    if (!isVoucherValid) {
      return {
        ...item,
        name,
        productSlug,
        originalPrice: original,
        finalPrice,
        priceAfterPromotion,
        promotionDiscount,
        voucherDiscount,
      }
    }

    // ===== RULE: ALL_REQUIRED =====
    if (rule === APPLICABILITY_RULE.ALL_REQUIRED) {
      if (type === VOUCHER_TYPE.PERCENT_ORDER && isEligible) {
        return {
          ...item,
          name,
          productSlug,
          originalPrice: original,
          finalPrice: priceAfterPromotion,
          priceAfterPromotion,
          promotionDiscount,
          voucherDiscount: 0,
        }
      }

      if (
        (type === VOUCHER_TYPE.FIXED_VALUE ||
          type === VOUCHER_TYPE.PERCENT_ORDER) &&
        isEligible
      ) {
        return {
          ...item,
          name,
          productSlug,
          originalPrice: original,
          finalPrice: priceAfterPromotion,
          priceAfterPromotion,
          promotionDiscount,
          voucherDiscount: 0,
        }
      }

      if (type === VOUCHER_TYPE.SAME_PRICE_PRODUCT && isEligible) {
        const newPrice =
          (voucher?.value || 0) <= 1
            ? Math.round(original * (1 - (voucher?.value || 0)))
            : Math.min(original, voucher?.value || 0)
        voucherDiscount = original - newPrice
        finalPrice = newPrice
        promotionDiscount = 0
      }

      return {
        ...item,
        name,
        productSlug,
        originalPrice: original,
        finalPrice,
        priceAfterPromotion,
        promotionDiscount,
        voucherDiscount,
      }
    }

    // ===== RULE: AT_LEAST_ONE_REQUIRED =====
    if (rule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED) {
      if (type === VOUCHER_TYPE.PERCENT_ORDER) {
        if (isEligible) {
          voucherDiscount = Math.round(((voucher?.value || 0) * original) / 100)
          finalPrice = priceAfterPromotion
          promotionDiscount = 0
          return {
            ...item,
            name,
            productSlug,
            originalPrice: original,
            finalPrice,
            priceAfterPromotion: original,
            promotionDiscount,
            voucherDiscount,
          }
        }
      } else if (type === VOUCHER_TYPE.FIXED_VALUE) {
        if (isEligible) {
          voucherDiscount = Math.min(original, voucher?.value || 0)
          finalPrice = priceAfterPromotion
          promotionDiscount = 0
          return {
            ...item,
            name,
            productSlug,
            originalPrice: original,
            finalPrice,
            priceAfterPromotion: original,
            promotionDiscount,
            voucherDiscount,
          }
        }
      } else if (type === VOUCHER_TYPE.SAME_PRICE_PRODUCT && isEligible) {
        const newPrice =
          (voucher?.value || 0) <= 1
            ? Math.round(original * (1 - (voucher?.value || 0)))
            : Math.min(original, voucher?.value || 0)
        voucherDiscount = original - newPrice
        finalPrice = newPrice
        promotionDiscount = 0
        return {
          ...item,
          name,
          productSlug,
          originalPrice: original,
          finalPrice,
          priceAfterPromotion: original,
          promotionDiscount,
          voucherDiscount,
        }
      }
    }

    return {
      ...item,
      name,
      productSlug,
      originalPrice: original,
      finalPrice: priceAfterPromotion,
      priceAfterPromotion,
      promotionDiscount,
      voucherDiscount: 0,
    }
  })
}
