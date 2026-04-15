/**
 * calculateOrderItemDisplayNative + calculatePlacedOrderTotalsNative
 * Gọi Native module (cùng logic calculateDisplayItems), fallback JS khi không có.
 */
import type { CartTotalsOutput } from './CartPriceCalc.types'
import CartPriceCalc from './CartPriceCalcModule'

/** Order item từ API — có variant.price, variant.product.slug */
type OrderDetailLike = {
  id?: string
  slug?: string
  quantity: number
  variant?: { price?: number; product?: { slug?: string; name?: string } }
  promotion?: { value?: number; type?: string }
}

/** Voucher cho order */
type VoucherLike = {
  type: string
  value?: number
  applicabilityRule: string
  minOrderValue?: number
  voucherProducts?: Array<{ product?: { slug?: string } }>
}

/** Transform order items sang format mà native calculateDisplayItems hiểu */
function orderDetailsToCartInput(
  orderItems: OrderDetailLike[],
): Array<Record<string, unknown>> {
  return orderItems.map((item) => {
    const original = item.variant?.price ?? 0
    const promotionValue = item.promotion?.value ?? 0
    return {
      id: item.id ?? item.slug ?? '',
      slug: item.slug ?? '',
      quantity: item.quantity,
      originalPrice: original,
      productSlug: item.variant?.product?.slug ?? item.slug ?? '',
      promotionValue,
      promotionDiscount:
        item.promotion?.type === 'per-product'
          ? Math.round(original * (promotionValue / 100))
          : 0,
      name: item.variant?.product?.name ?? '',
    }
  })
}

export interface OrderDisplayResult {
  displayItems: Array<Record<string, unknown>>
  totals: CartTotalsOutput
}

export function calculateOrderItemDisplayNative(
  orderItems: OrderDetailLike[],
  voucher: VoucherLike | null,
): OrderDisplayResult | null {
  if (!orderItems?.length) {
    return {
      displayItems: [],
      totals: {
        subTotalBeforeDiscount: 0,
        promotionDiscount: 0,
        voucherDiscount: 0,
        finalTotal: 0,
      },
    }
  }
  if (!CartPriceCalc) return null

  try {
    const cartInput = orderDetailsToCartInput(orderItems)
    const orderItemsJson = JSON.stringify(cartInput)
    const voucherJson = voucher
      ? JSON.stringify({
          type: voucher.type,
          value: voucher.value ?? 0,
          applicabilityRule: voucher.applicabilityRule,
          minOrderValue: voucher.minOrderValue ?? 0,
          voucherProducts: (voucher.voucherProducts ?? [])
            .filter((vp) => vp.product?.slug)
            .map((vp) => ({ product: { slug: vp.product!.slug } })),
        })
      : null

    const resultJson = CartPriceCalc.calculateDisplayItems(
      orderItemsJson,
      voucherJson,
    )
    const parsed = JSON.parse(resultJson) as {
      displayItems: Array<Record<string, unknown>>
      totals: CartTotalsOutput
    }
    return parsed
  } catch {
    return null
  }
}
