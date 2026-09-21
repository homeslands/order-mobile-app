/** Native Stack + Tabs. Bootstrap: lib/navigation-setup.ts */
import { Platform } from 'react-native'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

/**
 * QUAN TRỌNG: expo-router's usePathname() strip group segment — pathname
 * thật trả về '/home', '/menu', '/menu/product/xxx' (KHÔNG có '/(tabs)/'
 * prefix). Xem node_modules/expo-router/build/matchers.js
 * stripGroupSegmentsFromPath. So khớp bằng '/(tabs)/home' sẽ không bao giờ
 * match — đã dính bug này 3 lần trước đây.
 */
/** Tab paths — dùng router.replace() để đổi tab. */
export const TAB_ROUTES = {
  HOME: '/(tabs)/home',
  MENU: '/(tabs)/menu',
  // Android: giỏ hàng KHÔNG nằm trong (tabs) — thanh tab gốc không cho ẩn
  // một tab mà vẫn điều hướng tới (trigger `hidden` bị lọc khỏi navigator,
  // xem node_modules/expo-router/build/useScreens.js:123), nên màn giỏ hàng
  // ở stack gốc '/cart' (vỏ tại app/cart/index.tsx, re-export
  // app/(tabs)/cart.tsx). iOS giữ tab thứ 5 '/(tabs)/cart' với role="search".
  CART: Platform.OS === 'android' ? '/cart' : '/(tabs)/cart',
  GIFT_CARD: '/(tabs)/gift-card',
  PROFILE: '/(tabs)/profile',
} as const

export type TabRouteKey = keyof typeof TAB_ROUTES

/**
 * Stack: slide_from_right, gesture, freezeOnBlur.
 * Lưu ý: Layout thực tế dùng nativeStackScreenOptions từ layouts/custom-stack.
 * stackScreenOptions dùng làm reference — Spring 350ms, bezier fallback.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 350,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
  presentation: 'card',
  freezeOnBlur: true,
  contentStyle: { backgroundColor: '#ffffff' },
}
