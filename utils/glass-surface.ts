import { hexToRgba } from '@/lib/utils'

/**
 * Độ đục của lớp pha màu thương hiệu.
 *
 * Giữ đúng giá trị mà núm chỉnh độ trong cũ cho ra ở mức mặc định, nên các
 * bề mặt thương hiệu trông y như trước khi gỡ núm đó.
 */
const BRAND_TINT_OPACITY = 0.5

/**
 * Màu pha cho `GlassView`.
 *
 * KHÔNG pha gì (trả undefined) là trạng thái bình thường: `UIGlassEffect`
 * kiểu `.regular` khi không bị gán `tintColor` sẽ tự bám theo lựa chọn
 * Clear/Tinted của người dùng trong Cài đặt iOS. Chỉ bề mặt cần giữ màu
 * thương hiệu (nút giỏ hàng, thanh đơn sẵn sàng) mới truyền màu vào, và khi
 * đó nó cố ý đè lên lựa chọn hệ thống để màu không biến mất thành kính trong.
 */
export function glassTintColor(tint?: string): string | undefined {
  if (tint === undefined) return undefined
  return hexToRgba(tint, BRAND_TINT_OPACITY)
}
