import {
  ICartItem,
  IDisplayCartItem,
  IDisplayOrderItem,
  IOrderDetail,
  IOrderItem,
  IPromotion,
  IVoucher,
} from '@/types'

// ─── Re-exports (public API unchanged for @/utils consumers) ─────────────────

export { calculateCartItemDisplay } from './cart-item-display'
export { calculateOrderItemDisplay } from './order-item-display'
export {
  calculateCartTotals,
  calculatePlacedOrderTotals,
  calculateVoucherDiscountFromOrder,
} from './cart-totals'

// ─── Internal imports for the native-first facades ───────────────────────────

import { calculateCartItemDisplay } from './cart-item-display'
import { calculateCartTotals, calculatePlacedOrderTotals } from './cart-totals'
import { calculateOrderItemDisplay } from './order-item-display'

// ─── Transform ───────────────────────────────────────────────────────────────

// Transform IOrderItem to IOrderDetail for calculation compatibility
export function transformOrderItemToOrderDetail(
  orderItems: IOrderItem[],
): IOrderDetail[] {
  return orderItems.map((item) => ({
    id: item.id,
    slug: item.slug,
    createdAt: new Date().toISOString(),
    note: item.note || '',
    quantity: item.quantity,
    status: {
      PENDING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RUNNING: 0,
    },
    subtotal: (item.originalPrice || 0) * item.quantity,
    variant: item.variant,
    size: item.variant.size,
    trackingOrderItems: [],
    promotion: item.promotion
      ? ({
          slug:
            typeof item.promotion === 'string'
              ? item.promotion
              : item.promotion.slug,
          createdAt: new Date().toISOString(),
          title: '',
          branchSlug: '',
          description: '',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          value: item.promotionValue || 0,
          type: 'per-product',
        } as IPromotion)
      : undefined,
  }))
}

// ─── Native-first facades (kept here — dynamic require('cart-price-calc')) ───

/** Cart/order có orderItems + voucher — dùng cho tính display & totals */
type CartLike = { orderItems: IOrderItem[]; voucher?: IVoucher | null } | null

/** Native-first: calculateDisplayItems cho cart. Dùng cho create-order-dialog. */
export function calculateCartDisplayAndTotals(
  order: CartLike,
  voucher: IVoucher | null,
): {
  displayItems: IDisplayCartItem[]
  cartTotals: {
    subTotalBeforeDiscount: number
    promotionDiscount: number
    voucherDiscount: number
    finalTotal: number
  }
} {
  const v = voucher ?? order?.voucher ?? null
  if (!order?.orderItems?.length) {
    return {
      displayItems: [],
      cartTotals: {
        subTotalBeforeDiscount: 0,
        promotionDiscount: 0,
        voucherDiscount: 0,
        finalTotal: 0,
      },
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional native module; dynamic require allows try-catch fallback on web/Expo Go
    const { calculateDisplayItemsNative } = require('cart-price-calc') as {
      calculateDisplayItemsNative: (input: {
        orderItems: Array<Record<string, unknown>>
        voucher: Record<string, unknown> | null
      }) => {
        displayItems: IDisplayCartItem[]
        totals: {
          subTotalBeforeDiscount: number
          promotionDiscount: number
          voucherDiscount: number
          finalTotal: number
        }
      } | null
    }
    const nativeResult = calculateDisplayItemsNative({
      orderItems: order.orderItems as unknown as Array<Record<string, unknown>>,
      voucher: v
        ? {
            type: v.type,
            value: v.value,
            applicabilityRule: v.applicabilityRule,
            minOrderValue: v.minOrderValue,
            voucherProducts: v.voucherProducts,
          }
        : null,
    })
    if (nativeResult) {
      return {
        displayItems: nativeResult.displayItems as IDisplayCartItem[],
        cartTotals: nativeResult.totals,
      }
    }
  } catch {
    // Native module không có (Expo Go, web)
  }
  const displayItems = calculateCartItemDisplay(order as ICartItem, v)
  const cartTotals = calculateCartTotals(displayItems, v)
  return { displayItems, cartTotals }
}

/** Native-first: gọi cart-price-calc nếu có, fallback sang JS. Dùng cho payment, update-order, history. */
export function calculateOrderDisplayAndTotals(
  orderItems: IOrderDetail[],
  voucher: IVoucher | null,
): {
  displayItems: IDisplayOrderItem[]
  cartTotals: {
    subTotalBeforeDiscount: number
    promotionDiscount: number
    voucherDiscount: number
    finalTotal: number
  } | null
} {
  if (!orderItems?.length) {
    return {
      displayItems: [],
      cartTotals: null,
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional native module; dynamic require allows try-catch fallback on web/Expo Go
    const { calculateOrderItemDisplayNative } = require('cart-price-calc') as {
      calculateOrderItemDisplayNative: (
        items: unknown[],
        v: unknown,
      ) => { displayItems: IDisplayOrderItem[]; totals: unknown } | null
    }
    const nativeResult = calculateOrderItemDisplayNative(orderItems, voucher)
    if (nativeResult) {
      return {
        displayItems: nativeResult.displayItems as IDisplayOrderItem[],
        cartTotals: nativeResult.totals as {
          subTotalBeforeDiscount: number
          promotionDiscount: number
          voucherDiscount: number
          finalTotal: number
        },
      }
    }
  } catch {
    // Native module không có (Expo Go, web)
  }
  const displayItems = calculateOrderItemDisplay(orderItems, voucher)
  const cartTotals = calculatePlacedOrderTotals(displayItems, voucher)
  return { displayItems, cartTotals }
}
