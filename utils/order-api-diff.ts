/**
 * Diff utility cho update-order flow.
 *
 * So sánh originalItems vs draftItems theo slug để xác định:
 *  - Items cần DELETE (có trên server, bị xóa khỏi draft)
 *  - Items cần POST   (mới thêm vào draft, có temp slug)
 *  - Items cần UPDATE (đã tồn tại, số lượng hoặc ghi chú thay đổi)
 *
 * Cách nhận biết item mới (temp): slug bắt đầu bằng "item_"
 * (được tạo bởi generateOrderItemId trong update-order-flow.store.ts)
 */
import { IOrderItem } from '@/types'

/** Minimum shape needed from original order items for diff computation */
type OriginalItem = { slug: string; quantity: number; note?: string }

const TEMP_ID_PREFIX = 'item_'

export const isTempOrderItem = (slug: string): boolean =>
  slug.startsWith(TEMP_ID_PREFIX)

export interface IOrderApiDiff {
  /** Slugs của items cần gọi DELETE /order-items/{slug} */
  toDelete: string[]
  /** Items mới cần gọi POST /order-items (chưa có real slug) */
  toAdd: IOrderItem[]
  /** Items hiện tại cần update số lượng — PUT /order-items/{slug} */
  toUpdateQty: IOrderItem[]
  /** Items hiện tại + items mới (sau khi POST) cần update ghi chú */
  toUpdateNote: IOrderItem[]
}

export function computeOrderApiDiff(
  originalItems: OriginalItem[],
  draftItems: IOrderItem[],
): IOrderApiDiff {
  const originalBySlug = new Map(originalItems.map((i) => [i.slug, i]))

  // Slugs thật sự có trong draft (loại trừ temp)
  const draftRealSlugs = new Set(
    draftItems.filter((i) => !isTempOrderItem(i.slug)).map((i) => i.slug),
  )

  // Bước 2: xóa — có trong original nhưng không còn trong draft
  const toDelete = originalItems
    .filter((i) => !draftRealSlugs.has(i.slug))
    .map((i) => i.slug)

  // Bước 3: thêm mới — item có temp slug
  const toAdd = draftItems.filter((i) => isTempOrderItem(i.slug))

  // Bước 4: update qty — slug thật, số lượng khác original
  const toUpdateQty = draftItems
    .filter((i) => !isTempOrderItem(i.slug))
    .filter((i) => {
      const orig = originalBySlug.get(i.slug)
      return orig != null && orig.quantity !== i.quantity
    })

  // Bước 5: update note — slug thật + note thay đổi
  // (items mới sẽ được thêm vào bước 5 sau khi có real slug từ bước 3)
  const toUpdateNote = draftItems
    .filter((i) => !isTempOrderItem(i.slug))
    .filter((i) => {
      const orig = originalBySlug.get(i.slug)
      return orig != null && (orig.note ?? '') !== (i.note ?? '')
    })

  return { toDelete, toAdd, toUpdateQty, toUpdateNote }
}
