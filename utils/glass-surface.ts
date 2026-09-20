import { hexToRgba } from '@/lib/utils'

/**
 * Độ đục pha tối thiểu cho bề mặt thương hiệu — xem giải thích ở dưới.
 */
const TINT_FLOOR = 0.5

/**
 * Màu pha cho `GlassView` ứng với mức độ trong.
 *
 * `GlassView` không có tham số cường độ, chỉ có màu pha. Càng pha đục thì
 * kính càng giống nền đặc, nên mức trong `level` ánh xạ thành độ đục
 * `1 - level` của chính màu nền bề mặt.
 *
 * `level = 1` trả về undefined: kính nguyên bản, không pha gì.
 *
 * Ngoại lệ: hễ bên gọi truyền `tintOverride` (nút giỏ hàng, thanh đơn sẵn
 * sàng, toast...), độ đục không bao giờ xuống dưới `TINT_FLOOR` — kể cả ở
 * `level >= 1` — để màu đó không biến mất thành kính trong suốt. Không
 * truyền `tintOverride` thì giữ nguyên hành vi cũ.
 */
export function glassTint(
  color: string,
  level: number,
  tintOverride?: string,
): string | undefined {
  if (tintOverride !== undefined) {
    const opacity = Math.max(1 - Math.max(0, level), TINT_FLOOR)
    return hexToRgba(tintOverride, Math.round(opacity * 100) / 100)
  }
  if (level >= 1) return undefined
  const opacity = Math.round((1 - Math.max(0, level)) * 100) / 100
  return hexToRgba(color, opacity)
}
