/**
 * Product detail total — native-first. Tránh circular: không import stores.
 */
import type { IProductVariant } from '@/types'
import { formatCurrency } from '@/utils/formatCurrency'

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
let _nativeFn:
  | ((p: number, q: number, t: number, pr: number) => number | null)
  | null = null
let _nativeResolved = false

function getNativeCompute() {
  if (_nativeResolved) return _nativeFn
  _nativeResolved = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional native; dynamic require cho fallback web/Expo Go
    const mod = require('cart-price-calc') as {
      computeProductDetailTotalNative?: (
        p: number,
        q: number,
        t: number,
        pr: number,
      ) => number | null
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
    return nativeFn(
      price,
      quantity,
      toppingExtraPrice,
      promotionDiscountPercent,
    )
  }
  return computeProductDetailTotalJS(
    price,
    quantity,
    toppingExtraPrice,
    promotionDiscountPercent,
  )
}

/**
 * Nhãn giá trên thẻ size: size rẻ nhất ghi giá đầy đủ, size khác ghi phần
 * chênh ("+6.000 đ"). Khoá theo slug của variant.
 */
export function variantPriceLabels(
  variants: IProductVariant[],
): Map<string, string> {
  const labels = new Map<string, string>()
  if (variants.length === 0) return labels
  const min = Math.min(...variants.map((v) => v.price))
  for (const v of variants) {
    const delta = v.price - min
    labels.set(
      v.slug,
      delta > 0 ? `+${formatCurrency(delta)}` : formatCurrency(v.price),
    )
  }
  return labels
}
