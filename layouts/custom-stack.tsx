/**
 * Native Stack — Migrated from JS Stack (@react-navigation/stack).
 *
 * Uses @react-navigation/native-stack with native Fragment transitions (UI thread).
 * Animation chạy trên native thread → 60fps ổn định, không phụ thuộc JS.
 *
 * Deprecated props (JS Stack → Native Stack):
 * - cardStyleInterpolator → không hỗ trợ (dùng animation built-in)
 * - transitionSpec → dùng animationDuration nếu cần
 * - gestureResponseDistance → gestureResponseDistance (chỉ iOS)
 * - gestureVelocityImpact, gestureDirection → không có
 * - cardStyle → contentStyle
 * - cardShadowEnabled → native xử lý
 * - detachInactiveScreens → Native Stack không hỗ trợ
 *
 * @see docs/NATIVE_STACK_MIGRATION_AUDIT.md
 */
import type { ParamListBase } from '@react-navigation/native'
import {
  createNativeStackNavigator,
  type NativeStackNavigationEventMap,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack'
import { withLayoutContext } from 'expo-router'
import { Appearance, Platform } from 'react-native'

import { colors, MOTION } from '@/constants'
import { GESTURE_RESPONSE_DISTANCE } from '@/lib/navigation/interactive-transition'

// Đọc color scheme 1 lần lúc module load — đủ để tránh flash khi push.
// Không reactive (không update nếu user đổi theme mid-session), nhưng acceptable
// vì contentStyle chỉ visible trong ~50ms đầu của push animation.
const _isDark = Appearance.getColorScheme() === 'dark'

const { Navigator } = createNativeStackNavigator()

export const CustomStack = withLayoutContext<
  NativeStackNavigationOptions,
  typeof Navigator,
  import('@react-navigation/native').StackNavigationState<ParamListBase>,
  NativeStackNavigationEventMap
>(Navigator)

export const nativeStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'simple_push',
  // Dùng MOTION.nativeStack.durationMs để đồng bộ với navigation-lock và STACK_TRANSITION_DURATION_MS
  animationDuration: MOTION.nativeStack.durationMs,
  animationTypeForReplace: 'push',
  presentation: 'card',
  // Đồng bộ với color scheme để tránh white flash khi push sang màn mới trên dark mode.
  // contentStyle render trước React — nếu hardcode light sẽ flash trắng ~50-100ms.
  contentStyle: {
    backgroundColor: _isDark ? colors.background.dark : colors.background.light,
  },
  // 'dark' = text đen, 'light' = text trắng.
  // Dark mode cần 'light' để giờ/wifi/pin đọc được trên nền tối.
  statusBarStyle: _isDark ? 'light' : 'dark',
  statusBarTranslucent: true,
  // Bỏ gesture/shadow options tạm thời — tránh lỗi "expected boolean, had string" trên native bridge
  // gestureEnabled, fullScreenGestureEnabled, animationMatchesGesture, fullScreenGestureShadowEnabled
  ...(Platform.OS === 'android' && { headerTranslucent: true }),
  // Giới hạn vùng swipe-back từ cạnh trái để tránh xung đột với horizontal scroll.
  // `start` = khoảng cách từ leading edge (cạnh trái) nơi gesture có thể bắt đầu.
  ...(Platform.OS === 'ios' && {
    gestureResponseDistance: { start: GESTURE_RESPONSE_DISTANCE },
  }),
}

/**
 * Profile: slide_from_right + animationDuration 250ms (snappy).
 * fullScreenGestureEnabled: true — vuốt đóng có quán tính hãm phanh đồng bộ.
 * Header: headerShown: false (màn tự custom header). Bật headerShown: true nếu cần header native.
 */
export const profileNativeStackScreenOptions: NativeStackNavigationOptions = {
  ...nativeStackScreenOptions,
  animation: 'slide_from_right',
  animationDuration: MOTION.nativeStack.durationMs,
  /**
   * Giữ gesture toàn màn + animation bám theo ngón tay để cảm giác kéo-thả như Telegram.
   */
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
  // Full-screen gesture cần response distance = toàn màn để vuốt từ bất kỳ đâu.
  // Dùng const lớn thay vì Dimensions.get() — Dimensions capture tại module load
  // không react với iPad Split View/rotation, gây gesture hit area stale.
  // 10000 đủ lớn cho mọi device (iPad Pro 12.9" = 1366px landscape).
  // `start` = khoảng cách từ leading edge; giá trị lớn = toàn màn có thể bắt đầu gesture.
  ...(Platform.OS === 'ios' && {
    gestureResponseDistance: { start: 10000 },
  }),
  /**
   * Giữ presentation dạng card với shadow (kế thừa từ nativeStackScreenOptions) để tạo chiều sâu khi trượt.
   */
  presentation: 'card',
  /**
   * Mặc định ẩn header native; header custom trong màn sẽ trượt cùng card nên không bị giật.
   */
  headerShown: false,
}
