import { hexToRgba } from '@/lib/utils'

/**
 * Màu pha cho `GlassView` ứng với mức độ trong.
 *
 * `GlassView` không có tham số cường độ, chỉ có màu pha. Càng pha đục thì
 * kính càng giống nền đặc, nên mức trong `level` ánh xạ thành độ đục
 * `1 - level` của chính màu nền bề mặt.
 *
 * `level = 1` trả về undefined: kính nguyên bản, không pha gì.
 */
export function glassTint(
  color: string,
  level: number,
  tintOverride?: string,
): string | undefined {
  if (level >= 1) return undefined
  const opacity = Math.round((1 - Math.max(0, level)) * 100) / 100
  return hexToRgba(tintOverride ?? color, opacity)
}
