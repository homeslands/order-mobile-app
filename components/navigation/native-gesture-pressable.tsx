import React, { useCallback, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { MOTION, SPRING_CONFIGS } from '@/constants'
import type { HrefLike } from '@/lib/navigation'
import { executeNavFromGesture } from '@/lib/navigation'
import { isLockedShared } from '@/lib/navigation/navigation-lock-shared'

export type NativeGesturePressableProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Navigation: push | replace | navigate | back. Dùng thay onPress cho zero-latency. */
  navigation?:
    | { type: 'push'; href: HrefLike }
    | { type: 'replace'; href: HrefLike }
    | { type: 'navigate'; href: HrefLike }
    | { type: 'back' }
  /** Gọi TRƯỚC navigation. Nếu return Promise thì await trước khi navigate. Giữ lightweight — không JSON.parse / tính voucher — để tránh back-pressure từ runOnJS. */
  beforeNavigate?: () => void | Promise<void>
  /** Fallback: gọi khi có navigation. Nếu chỉ truyền onPress, dùng setImmediate. */
  onPress?: () => void
  /** Gọi ngay khi State.BEGAN (finger down). Dùng cho prefetch. */
  onPressIn?: () => void
  /** Gọi khi State.END (finger up). */
  onPressOut?: () => void
  /**
   * Worklet chạy ngay trên UI thread khi tap được công nhận, trước navigation.
   * Dùng cho hiệu ứng phải khớp với cú chạm chứ không chờ màn mới dựng xong.
   */
  onTapWorklet?: () => void
  disabled?: boolean
  /** className cho NativeWind */
  className?: string
  /** Haptic: giữ prop cho compat nhưng hiện không sử dụng. */
  hapticStyle?: 'none' | 'light' | 'medium'
}

/**
 * NativeGesturePressable — Zero-latency navigation.
 * Gesture handler native → setImmediate → router.push trong <16ms.
 */
export const NativeGesturePressable = React.forwardRef<
  View,
  NativeGesturePressableProps
>(function NativeGesturePressable(
  {
    children,
    style,
    navigation,
    beforeNavigate,
    onPress,
    onPressIn,
    onPressOut,
    onTapWorklet,
    disabled,
    className,
    hapticStyle: _hapticStyle = 'none', // giữ prop để không break API, nhưng không dùng
  },
  ref,
) {
  const pressScale = useSharedValue(1)

  const triggerAction = useCallback(() => {
    // Sync path: không await — navigation ngay cùng frame với finger up.
    const result = beforeNavigate?.()
    if (result instanceof Promise) {
      result.then(() => {
        if (navigation) {
          executeNavFromGesture(
            navigation.type,
            navigation.type === 'back' ? undefined : navigation.href,
          )
        }
        if (onPress) setImmediate(onPress)
      })
      return
    }
    if (navigation) {
      executeNavFromGesture(
        navigation.type,
        navigation.type === 'back' ? undefined : navigation.href,
      )
    }
    if (onPress) setImmediate(onPress)
  }, [beforeNavigate, navigation, onPress])

  // Chỉ lấy khoá dùng chung khi CHÍNH component này điều hướng stack
  // (push/replace/back): khi đó executeNavFromGesture → lockNavigation +
  // scheduleUnlock sẽ mở khoá lại. Hai trường hợp KHÔNG lấy khoá:
  // - Tab navigate: tab switch instant, expo-router Tabs tự xử lý concurrent
  //   navigate calls.
  // - Chỉ có onPress (không prop navigation): không ai hẹn giờ mở khoá. Nếu
  //   onPress không tạo transition (mở sheet, chuyển tab, gọi điện), khoá kẹt
  //   vĩnh viễn và MỌI nút điều hướng khác trong app chết theo. onPress tự lo
  //   chống chạm trùng của nó (vd. guard trong useQrActions, hoặc navigateNative
  //   tự khoá qua engine).
  const usesNavigationLock =
    navigation !== undefined && navigation.type !== 'navigate'

  const tapGesture = useMemo(() => {
    const gesture = Gesture.Tap()
      // Cho jest-utils của gesture-handler (fireGestureHandler) tìm được.
      .withTestId('native-gesture-pressable')
      .enabled(!disabled)
      .maxDuration(300)
      // Cho phép di chuyển rất nhỏ khi tap; nếu kéo nhiều hơn thì coi như scroll, không trigger tap.
      .maxDistance(10)
      .onBegin(() => {
        'worklet'
        // Scale ngay lập tức (≈80ms) — chạy trên UI thread, không qua bridge
        pressScale.value = withTiming(MOTION.pressScale, { duration: 80 })
        // onPressIn: prefetch ngay khi finger down (trước khi nhả tay)
        if (onPressIn) runOnJS(onPressIn)()
      })
      .onStart(() => {
        'worklet'
        // Khi Tap được công nhận (finger up, không bị scroll), mới trigger navigate.

        // Không lấy khoá (tab navigate, hoặc chỉ có onPress) — xem
        // usesNavigationLock. Lock check ở đây sẽ drop legitimate rapid taps.
        if (!usesNavigationLock) {
          if (onTapWorklet) onTapWorklet()
          runOnJS(triggerAction)()
          pressScale.value = withSpring(1, SPRING_CONFIGS.press)
          return
        }

        // Stack push/replace/back: atomic lock check + set trong worklet.
        // SET lock NGAY trong worklet (không đợi runOnJS → executeNav →
        // lockNavigation) để tap tiếp theo trong <16ms thấy lock đã acquired.
        // Nếu set qua JS thread, có race window ~1 frame giữa 2 taps liên tiếp.
        if (isLockedShared.value === 1) {
          pressScale.value = withSpring(1, SPRING_CONFIGS.press)
          return
        }
        isLockedShared.value = 1
        if (onTapWorklet) onTapWorklet()
        runOnJS(triggerAction)()
        pressScale.value = withSpring(1, SPRING_CONFIGS.press)
      })
      .onFinalize(() => {
        'worklet'
        pressScale.value = withSpring(1, SPRING_CONFIGS.press)
        if (onPressOut) {
          runOnJS(onPressOut)()
        }
      })

    return gesture
  }, [
    disabled,
    onPressOut,
    triggerAction,
    pressScale,
    onPressIn,
    onTapWorklet,
    usesNavigationLock,
  ])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        ref={ref}
        style={[style, animatedStyle]}
        className={className}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  )
})
