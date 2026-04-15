/**
 * T0: Diffing Off-screen — cache displayItems vào MMKV.
 * Khi mount Cart: render ngay kết quả cũ (static). Sau InteractionManager mới tính lại.
 */
import type { IDisplayCartItem } from '@/types'

import { getSyncItem, setSyncItem } from './storage'

const CART_DISPLAY_CACHE_KEY = 'cart_display_items'

export function getCachedDisplayItems(): IDisplayCartItem[] | null {
  try {
    const raw = getSyncItem(CART_DISPLAY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as IDisplayCartItem[]
  } catch {
    return null
  }
}

export function setCachedDisplayItems(items: IDisplayCartItem[]): void {
  try {
    if (items.length === 0) return
    setSyncItem(CART_DISPLAY_CACHE_KEY, JSON.stringify(items))
  } catch {
    // no-op
  }
}
