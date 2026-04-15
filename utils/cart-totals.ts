import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import {
  IDisplayCartItem,
  IDisplayOrderItem,
  IOrderDetail,
  IVoucher,
  IVoucherProduct,
} from '@/types'

import { sumBy } from './cart-voucher.helpers'

export function calculateCartTotals(
  displayItems: IDisplayCartItem[],
  voucher: IVoucher | null,
) {
  // T9: Set O(m) thay vì array — tránh O(n*m) khi .includes() trong loop
  const allowedProductSlugsSet = new Set(
    voucher?.voucherProducts?.map((vp) => vp.product?.slug).filter(Boolean) ??
      [],
  )

  const subTotalBeforeDiscount = sumBy(
    displayItems,
    (item) => (item.originalPrice || 0) * (item.quantity || 0),
  )

  const promotionDiscount = sumBy(displayItems, (item) => {
    const shouldExcludePromotion =
      (voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT ||
        ((voucher?.type === VOUCHER_TYPE.PERCENT_ORDER ||
          voucher?.type === VOUCHER_TYPE.FIXED_VALUE) &&
          voucher?.applicabilityRule ===
            APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED)) &&
      allowedProductSlugsSet.has(item.slug ?? '') &&
      item.voucherDiscount &&
      item.voucherDiscount > 0

    const discount =
      !shouldExcludePromotion &&
      item.promotionDiscount &&
      item.promotionDiscount > 0
        ? item.promotionDiscount
        : 0

    return discount * (item.quantity || 0)
  })

  let voucherDiscount = 0

  if (voucher) {
    const rule = voucher.applicabilityRule
    const type = voucher.type

    if (type === VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
      voucherDiscount = sumBy(displayItems, (item) => {
        if (allowedProductSlugsSet.has(item.slug ?? '')) {
          return (item.voucherDiscount || 0) * (item.quantity || 0)
        }
        return 0
      })
    } else if (type === VOUCHER_TYPE.PERCENT_ORDER) {
      if (rule === APPLICABILITY_RULE.ALL_REQUIRED) {
        const totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
        voucherDiscount = Math.round(
          ((voucher.value || 0) / 100) * totalAfterPromo,
        )
      } else {
        voucherDiscount = sumBy(displayItems, (item) => {
          return (item.voucherDiscount || 0) * (item.quantity || 0)
        })
      }
    } else if (type === VOUCHER_TYPE.FIXED_VALUE) {
      if (rule === APPLICABILITY_RULE.ALL_REQUIRED) {
        const totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
        voucherDiscount = Math.min(voucher.value || 0, totalAfterPromo)
      } else {
        voucherDiscount = sumBy(displayItems, (item) => {
          return (item.voucherDiscount || 0) * (item.quantity || 0)
        })
      }
    }
  }

  const finalTotal =
    subTotalBeforeDiscount - promotionDiscount - voucherDiscount

  return {
    subTotalBeforeDiscount,
    promotionDiscount,
    voucherDiscount,
    finalTotal,
  }
}

export function calculatePlacedOrderTotals(
  displayItems: IDisplayOrderItem[],
  voucher: IVoucher | null,
) {
  if (!displayItems || !displayItems.length) return null

  const allowedProductSlugs =
    voucher?.voucherProducts?.map((vp: IVoucherProduct) => vp.product?.slug) ||
    []

  const subTotalBeforeDiscount = displayItems.reduce(
    (sum, item) => sum + (item.originalPrice || 0) * (item.quantity || 0),
    0,
  )

  const promotionDiscount = displayItems.reduce((sum, item) => {
    const shouldExcludePromotion =
      (voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT ||
        ((voucher?.type === VOUCHER_TYPE.PERCENT_ORDER ||
          voucher?.type === VOUCHER_TYPE.FIXED_VALUE) &&
          voucher?.applicabilityRule ===
            APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED)) &&
      allowedProductSlugs.includes(item.productSlug) &&
      item.voucherDiscount &&
      item.voucherDiscount > 0

    const discount =
      !shouldExcludePromotion &&
      item.promotionDiscount &&
      item.promotionDiscount > 0
        ? item.promotionDiscount
        : 0

    return sum + discount * (item.quantity || 0)
  }, 0)

  let voucherDiscount = 0

  if (voucher) {
    const rule = voucher.applicabilityRule
    const type = voucher.type

    if (type === VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
      voucherDiscount = displayItems.reduce((sum, item) => {
        if (allowedProductSlugs.includes(item.productSlug)) {
          return sum + (item.voucherDiscount || 0) * (item.quantity || 0)
        }
        return sum
      }, 0)
    } else if (type === VOUCHER_TYPE.PERCENT_ORDER) {
      if (rule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED) {
        voucherDiscount = displayItems.reduce((sum, item) => {
          if (allowedProductSlugs.includes(item.productSlug)) {
            const discount = Math.round(
              ((voucher.value || 0) * (item.originalPrice || 0)) / 100,
            )
            return sum + discount * (item.quantity || 0)
          }
          return sum
        }, 0)
      } else {
        const totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
        voucherDiscount = Math.round(
          ((voucher.value || 0) * totalAfterPromo) / 100,
        )
      }
    } else if (type === VOUCHER_TYPE.FIXED_VALUE) {
      if (rule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED) {
        voucherDiscount = displayItems.reduce((sum, item) => {
          if (allowedProductSlugs.includes(item.productSlug)) {
            const discount = Math.min(
              item.originalPrice || 0,
              voucher.value || 0,
            )
            return sum + discount * (item.quantity || 0)
          }
          return sum
        }, 0)
      } else {
        const totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
        voucherDiscount = Math.min(voucher.value || 0, totalAfterPromo)
      }
    }
  }

  const finalTotal =
    subTotalBeforeDiscount - promotionDiscount - voucherDiscount

  return {
    subTotalBeforeDiscount,
    promotionDiscount,
    voucherDiscount,
    finalTotal,
  }
}

export function calculateVoucherDiscountFromOrder(
  orderItems: IOrderDetail[],
  voucher: IVoucher | null,
): number {
  if (!voucher || !orderItems?.length) return 0

  const originalTotal = orderItems.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0,
  )

  let voucherDiscount = 0

  switch (voucher.type) {
    case VOUCHER_TYPE.PERCENT_ORDER:
      voucherDiscount = (originalTotal * (voucher.value || 0)) / 100
      break

    case VOUCHER_TYPE.SAME_PRICE_PRODUCT: {
      const voucherProductSlugs =
        voucher.voucherProducts?.map((vp) => vp.product.slug) || []

      for (const item of orderItems) {
        const productSlug = item.variant.product.slug
        const quantity = item.quantity
        const originalPrice = item.variant.price

        if (voucherProductSlugs.includes(productSlug)) {
          const diff = (originalPrice - voucher.value) * quantity
          if (diff > 0) voucherDiscount += diff
        }
      }
      break
    }

    case VOUCHER_TYPE.FIXED_VALUE:
      voucherDiscount = voucher.value || 0
      break

    default:
      voucherDiscount = 0
  }

  return voucherDiscount
}
