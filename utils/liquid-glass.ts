import { isLiquidGlassAvailable } from 'expo-glass-effect'

/**
 * Máy này có Liquid Glass hay không (iOS 26+ và bản iOS có sẵn API).
 *
 * Hỏi hệ thống đúng một lần lúc nạp module: giá trị không đổi trong phiên
 * chạy, nên không cần hook và không gây re-render.
 *
 * Nhớ: khi không có kính, `GlassView` rơi về `View` trơn và **mất luôn nền**.
 * Mọi chỗ dùng kính đều phải có nhánh nền đặc cho iOS cũ và Android.
 */
export const HAS_LIQUID_GLASS = isLiquidGlassAvailable()
