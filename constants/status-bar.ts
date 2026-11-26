/**
 * Truly static top/bottom insets — computed once at module load from native constants.
 * NO hooks, NO re-renders, NO transitions can change these values.
 *
 * Android: `StatusBar.currentHeight` — native bridge constant.
 * iOS: `initialWindowMetrics.insets.*` — snapshot taken when SafeAreaProvider
 *       initialises (before any React render), accounts for notch / Dynamic Island.
 */
import { Platform, StatusBar } from 'react-native'
import { initialWindowMetrics } from 'react-native-safe-area-context'

/**
 * Top inset safe for paddingTop in headers.
 * Immune to `useSafeAreaInsets` re-renders and `statusBarTranslucent` toggling.
 */
export const STATIC_TOP_INSET: number =
  Platform.OS === 'android'
    ? StatusBar.currentHeight || 24 // || catches both null and 0 (cold-start edge case)
    : // -4 để nội dung không bị quá sát mép trên notch/Dynamic Island.
      // Math.max(..., 20) bảo vệ non-notch iPhone (SE, 8) có status bar chỉ 20px —
      // nếu không sẽ bị trừ thành 16 và header chồng lên status bar 4px.
      Math.max((initialWindowMetrics?.insets.top ?? 47) - 4, 20)

/**
 * Bottom inset safe for tab bar positioning — computed once, no re-renders.
 *
 * Dùng cho tab bar layout tĩnh (vị trí không đổi theo orientation trên điện thoại).
 * KHÔNG dùng cho scroll content padding hay bottom sheet — dùng useSafeAreaInsets() ở đó.
 *
 * iOS: home indicator / safe area bottom (~34px notch, ~0px non-notch)
 * Android: gesture navigation bar (~24px) hoặc button nav (0)
 */
export const STATIC_BOTTOM_INSET: number =
  initialWindowMetrics?.insets.bottom ?? 0

/**
 * Khoảng thêm trên khoảng an toàn dưới cho thanh nút cố định ở đáy màn
 * (Đặt hàng, Thanh toán, nút ở Chi tiết món / Chi tiết đơn…).
 *
 * Máy có thanh home / thanh cử chỉ: khoảng an toàn đã đẩy nút lên trên thanh
 * đó (như app gốc iOS) — chỉ thêm 8. Trước đây cộng 28 → iPhone cách đáy 62pt,
 * gần gấp đôi cần thiết. Máy không có (SE / 8, Android nút cứng): thêm 16 để
 * nút không sát mép.
 *   iPhone có thanh home (bottom ≈ 34): 34 + 8 = 42
 *   Android thanh cử chỉ  (bottom ≈ 24): 24 + 8 = 32
 *   Không có thanh home   (bottom =  0):  0 + 16 = 16
 *
 * Dùng: `paddingBottom: insets.bottom + FOOTER_BOTTOM_EXTRA`.
 * KHÔNG dùng trong bottom sheet — sheet tự lo khoảng an toàn.
 */
export const FOOTER_BOTTOM_EXTRA: number = STATIC_BOTTOM_INSET > 0 ? 8 : 16
