/**
 * CartDisplayItem — flat display-ready type adapted from IOrderItem.
 * Shared between cart-item-row, cart-content, cart-footer, etc.
 */
import type { IOrderItem } from '@/types'
import { getProductImageUrl } from '@/utils/product-image-url'

export type CartDisplayItem = {
  cartKey: string
  productId: string
  name: string
  variantSlug: string
  sizeSlug: string
  sizeName: string
  price: number
  originalPrice: number
  quantity: number
  promotionValue: number
  note: string
  imageUrl: string | null
}

/** Compute per-unit voucher discount for a single display item — O(1), no loop */
export function calcItemVoucherDiscount(
  item: CartDisplayItem,
  voucher: { type: string; value: number; voucherProducts?: { product?: { slug?: string } }[] } | null,
): number {
  if (!voucher) return 0
  const vpSet = voucher.voucherProducts
  const eligible =
    !vpSet || vpSet.length === 0 ||
    vpSet.some((vp) => vp.product?.slug === item.productId)
  if (!eligible) return 0
  if (voucher.type === 'same_price_product') {
    const newPrice = voucher.value <= 1
      ? Math.round(item.originalPrice * (1 - voucher.value))
      : Math.min(item.originalPrice, voucher.value)
    return item.originalPrice - newPrice
  }
  if (voucher.type === 'percent_order') {
    return Math.round(item.originalPrice * (voucher.value / 100))
  }
  if (voucher.type === 'fixed_value') {
    return Math.min(item.originalPrice, voucher.value)
  }
  return 0
}

/** Cached adapter: reuses previous object if IOrderItem ref is unchanged → memo comparison works */
const displayItemCache = new WeakMap<IOrderItem, CartDisplayItem>()

export function toDisplayItem(item: IOrderItem): CartDisplayItem {
  const cached = displayItemCache.get(item)
  if (cached) return cached

  const promoValue = item.promotionValue ?? 0
  const originalPrice = item.originalPrice ?? 0
  const price = promoValue > 0
    ? Math.round(originalPrice * (1 - promoValue / 100))
    : originalPrice
  const result: CartDisplayItem = {
    cartKey: item.id,
    productId: item.productSlug || item.slug || '',
    name: item.name,
    variantSlug: item.variant?.slug ?? '',
    sizeSlug: item.variant?.size?.slug ?? '',
    sizeName: item.size || '',
    price,
    originalPrice,
    quantity: item.quantity,
    promotionValue: promoValue,
    note: item.note || '',
    imageUrl: getProductImageUrl(item.image) ?? null,
  }
  displayItemCache.set(item, result)
  return result
}
