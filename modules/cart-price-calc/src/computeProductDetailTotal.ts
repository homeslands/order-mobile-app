/**
 * computeProductDetailTotal — Native offload cho (price*(1-promo%) + topping) * qty.
 */
import CartPriceCalc from './CartPriceCalcModule'

function computeProductDetailTotalJS(
  price: number | null,
  quantity: number,
  toppingExtraPrice: number,
  promotionDiscountPercent: number,
): number | null {
  if (price == null) return null
  const afterDiscount = price * (1 - promotionDiscountPercent / 100)
  return (afterDiscount + toppingExtraPrice) * quantity
}

export function computeProductDetailTotalNative(
  price: number | null,
  quantity: number,
  toppingExtraPrice: number,
  promotionDiscountPercent: number,
): number | null {
  if (price == null) return null
  if (!CartPriceCalc) {
    return computeProductDetailTotalJS(
      price,
      quantity,
      toppingExtraPrice,
      promotionDiscountPercent,
    )
  }
  try {
    return CartPriceCalc.computeProductDetailTotal(
      price,
      quantity,
      toppingExtraPrice,
      promotionDiscountPercent,
    )
  } catch {
    return computeProductDetailTotalJS(
      price,
      quantity,
      toppingExtraPrice,
      promotionDiscountPercent,
    )
  }
}
