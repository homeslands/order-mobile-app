/**
 * PressableWithFeedback — Scale + Haptic cho nút bấm quan trọng (không phải navigation).
 *
 * - withSpring (SPRING_CONFIGS.press) — phản hồi vật lý
 * - Haptic Light khi finger down (onBegin)
 * - Scale <16ms — chạy trên UI thread
 *
 * Dùng cho: Add to cart, Submit button, v.v.
 * Cho navigation: dùng NativeGesturePressable.
 */
import * as Haptics from 'expo-haptics'
import React, { useCallback, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { MOTION, SPRING_CONFIGS } from '@/constants'

export type PressableWithFeedbackProps = {
  children: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  className?: string
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number }
  /** Haptic: 'none' (default), 'light' cho nút thường, 'medium' cho nút quan trọng. */
  hapticStyle?: 'none' | 'light' | 'medium'
}

const triggerHapticLight = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

const triggerHapticMedium = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

export const PressableWithFeedback = React.forwardRef<
  View,
  PressableWithFeedbackProps
>(function PressableWithFeedback(
  {
    children,
    onPress,
    disabled,
    style,
    className,
    hitSlop,
    hapticStyle = 'none',
  },
  ref,
) {
  const pressScale = useSharedValue(1)
  const triggerHaptic =
    hapticStyle === 'medium'
      ? triggerHapticMedium
      : hapticStyle === 'light'
        ? triggerHapticLight
        : null

  const handlePress = useCallback(() => {
    onPress?.()
  }, [onPress])

  const tapGesture = useMemo(() => {
    return Gesture.Tap()
      .enabled(!disabled)
      .maxDuration(300)
      .maxDistance(20)
      .shouldCancelWhenOutside(false)
      .hitSlop(hitSlop)
      .onBegin(() => {
        'worklet'
        pressScale.value = withSpring(MOTION.pressScale, SPRING_CONFIGS.press)
        if (triggerHaptic) runOnJS(triggerHaptic)()
      })
      .onStart(() => {
        'worklet'
        pressScale.value = withSpring(1, SPRING_CONFIGS.press)
        runOnJS(handlePress)()
      })
      .onFinalize(() => {
        'worklet'
        pressScale.value = withSpring(1, SPRING_CONFIGS.press)
      })
  }, [disabled, hitSlop, handlePress, triggerHaptic, pressScale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        ref={ref}
        style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
        className={className}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  )
})
