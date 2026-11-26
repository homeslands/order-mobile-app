/**
 * Tồn kho món + trạng thái hiển thị khi tải thực đơn / chi tiết món.
 * Hàm thuần, dùng chung cho Menu và trang chi tiết món.
 */
import {
  extractStatusCode,
  MENU_QUERY_SKIP_CODES,
} from '@/lib/global-error-gate'

/** Món còn đặt được: không bị khoá và (còn số lượng hoặc không giới hạn). */
export function hasMenuItemStock(item: {
  isLocked?: boolean
  currentStock?: number | null
  isLimit?: boolean
}): boolean {
  return !item.isLocked && ((item.currentStock ?? 0) > 0 || !item.isLimit)
}

export type ProductAddButtonState = 'loading' | 'error' | 'outOfStock' | 'ready'

/**
 * Trạng thái nút "Thêm vào giỏ" ở trang chi tiết món. Chưa có dữ liệu thì
 * không thể biết còn hàng hay không — chỉ được nói "Hết hàng" khi đã có dữ liệu.
 */
export function getProductAddButtonState(input: {
  hasData: boolean
  isError: boolean
  hasStock: boolean
  hasSelectedVariant: boolean
}): ProductAddButtonState {
  if (!input.hasData) return input.isError ? 'error' : 'loading'
  if (!input.hasStock) return 'outOfStock'
  if (!input.hasSelectedVariant) return 'loading'
  return 'ready'
}

export type MenuListEmptyState = 'loading' | 'error' | 'empty'

/** Danh sách món đang rỗng: đang tải, tải lỗi, hay thật sự chưa có món. */
export function getMenuListEmptyState(input: {
  isLoading: boolean
  isError: boolean
  isRetrying: boolean
}): MenuListEmptyState {
  if (input.isLoading) return 'loading'
  if (input.isError) return input.isRetrying ? 'loading' : 'error'
  return 'empty'
}

/**
 * Lỗi tải thực đơn thật sự. Các mã trong MENU_QUERY_SKIP_CODES là trạng thái
 * bình thường (vd 117002: danh mục không có món hôm nay), không phải lỗi.
 */
export function isMenuLoadError(error: unknown): boolean {
  if (error == null) return false
  const code = extractStatusCode(error)
  return code == null || !MENU_QUERY_SKIP_CODES.includes(code)
}
