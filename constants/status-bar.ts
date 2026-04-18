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
 * Extra bottom padding added on top of the safe area inset for sticky footer
 * buttons at the bottom of a screen (checkout, payment, product CTA, etc.).
 *
 * Keeps buttons comfortably clear of the screen edge on every device:
 *   iOS notch/Dynamic Island  (bottom ≈ 34): 34 + 20 = 54px — spacious
 *   iOS no-notch SE/8         (bottom ≈  0):  0 + 20 = 20px — comfortable
 *   Android gesture nav       (bottom ≈ 24): 24 + 20 = 44px — comfortable
 *   Android button/no nav     (bottom =   0):  0 + 20 = 20px — comfortable
 *
 * Usage: `paddingBottom: insets.bottom + FOOTER_BOTTOM_EXTRA`
 *
 * Do NOT use inside bottom sheets — the sheet handles safe area internally.
 */
export const FOOTER_BOTTOM_EXTRA = 28
