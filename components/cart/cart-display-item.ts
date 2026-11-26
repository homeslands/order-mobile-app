/**
 * CartDisplayItem — flat display-ready type adapted from IOrderItem.
 * Shared between cart-item-row, cart-content, cart-footer, etc.
 */
import type { IOrderItem } from '@/types'
import { getProductImageUrl, IMAGE_PRESET } from '@/utils/product-image-url'

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
  /** Món có hơn một size — chỉ khi đó mới hiện nút đổi size */
  hasSizeChoice: boolean
}

/** Cached adapter: reuses previous object if IOrderItem ref is unchanged → memo comparison works */
const displayItemCache = new WeakMap<IOrderItem, CartDisplayItem>()

export function toDisplayItem(item: IOrderItem): CartDisplayItem {
  const cached = displayItemCache.get(item)
  if (cached) return cached

  const promoValue = item.promotionValue ?? 0
  const originalPrice = item.originalPrice ?? 0
  const price =
    promoValue > 0
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
    imageUrl:
      getProductImageUrl(item.image, { maxWidth: IMAGE_PRESET.THUMB }) ?? null,
    hasSizeChoice: (item.allVariants?.length ?? 0) > 1,
  }
  displayItemCache.set(item, result)
  return result
}
