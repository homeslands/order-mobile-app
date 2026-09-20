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
 * Ngoại lệ: khi `tintOverride` khác `color` (bề mặt thương hiệu như nút giỏ
 * hàng, thanh đơn sẵn sàng), độ đục không bao giờ xuống dưới `TINT_FLOOR` —
 * kể cả ở `level >= 1` — để màu thương hiệu không biến mất thành kính trong
 * suốt. Khi không có `tintOverride`, hoặc nó bằng `color` (bề mặt trung
 * tính như toast), giữ nguyên hành vi cũ.
 */
export function glassTint(
  color: string,
  level: number,
  tintOverride?: string,
): string | undefined {
  const isBrandTint = tintOverride !== undefined && tintOverride !== color
  if (isBrandTint) {
    const opacity = Math.max(1 - Math.max(0, level), TINT_FLOOR)
    return hexToRgba(tintOverride, Math.round(opacity * 100) / 100)
  }
  if (level >= 1) return undefined
  const opacity = Math.round((1 - Math.max(0, level)) * 100) / 100
  return hexToRgba(tintOverride ?? color, opacity)
}
