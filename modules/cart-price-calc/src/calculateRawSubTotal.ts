/**
 * calculateRawSubTotal — Native offload cho sum(originalPrice * quantity).
 * Chỉ offload khi cart > 50 items (P5).
 */
import CartPriceCalc from './CartPriceCalcModule'

type CartItemLike = { originalPrice?: number; quantity?: number }

export function calculateRawSubTotalNative(
  orderItems: CartItemLike[],
): number {
  if (!orderItems?.length) return 0
  if (!CartPriceCalc) {
    return orderItems.reduce(
      (sum, i) => sum + (i.originalPrice ?? 0) * (i.quantity ?? 1),
      0,
    )
  }
  try {
    const orderItemsJson = JSON.stringify(
      orderItems.map((i) => ({
        originalPrice: i.originalPrice ?? 0,
        quantity: i.quantity ?? 1,
      })),
    )
    return CartPriceCalc.calculateRawSubTotal(orderItemsJson)
  } catch {
    return orderItems.reduce(
      (sum, i) => sum + (i.originalPrice ?? 0) * (i.quantity ?? 1),
      0,
    )
  }
}
