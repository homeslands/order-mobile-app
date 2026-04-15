/**
 * Product detail total — native-first. Tránh circular: không import stores.
 */
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

/** Cached native module ref — resolved once, not on every call */
let _nativeFn: ((p: number, q: number, t: number, pr: number) => number | null) | null = null
let _nativeResolved = false

function getNativeCompute() {
  if (_nativeResolved) return _nativeFn
  _nativeResolved = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional native; dynamic require cho fallback web/Expo Go
    const mod = require('cart-price-calc') as {
      computeProductDetailTotalNative?: (p: number, q: number, t: number, pr: number) => number | null
    }
    _nativeFn = mod.computeProductDetailTotalNative ?? null
  } catch {
    _nativeFn = null
  }
  return _nativeFn
}

/** Native-first: computeProductDetailTotal khi có cart-price-calc. */
export function computeProductDetailTotal(
  price: number | null,
  quantity: number,
  toppingExtraPrice: number,
  promotionDiscountPercent: number,
): number | null {
  if (price == null) return null
  const nativeFn = getNativeCompute()
  if (nativeFn) {
    return nativeFn(price, quantity, toppingExtraPrice, promotionDiscountPercent)
  }
  return computeProductDetailTotalJS(price, quantity, toppingExtraPrice, promotionDiscountPercent)
}
