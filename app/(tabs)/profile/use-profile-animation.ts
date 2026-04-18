import { useCallback, useMemo } from 'react'
import { Dimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { SNAP_BRAKE_CONFIG } from './transition-config'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// Edge area (px) nơi pan gesture có thể KHỞI ĐỘNG từ vị trí 0.
// Chỉ cho phép swipe-to-close bắt đầu từ cạnh trái — tránh touch leak
// từ tab bar (pointerEvents: box-none) hoặc scroll gesture xuyên qua.
const EDGE_ACTIVATION_AREA = 32
// Ngưỡng movement trước khi pan activate. 10px cũ quá nhạy với rapid tap
// (finger drift 10-20px khi tap tab khác nhau). Tăng lên 20px.
const ACTIVATION_OFFSET = 20

const applyResistance = (value: number, max: number) => {
  'worklet'
  if (value < 0) return value * 0.35
  if (value > max) {
    const excess = value - max
    return max + excess * 0.35
  }
  return value
}

export const useProfileAnimation = (onBack?: () => void) => {
  const translateX = useSharedValue(0)

  const openProfile = useCallback(() => {
    'worklet'
    translateX.value = withSpring(0, SNAP_BRAKE_CONFIG)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateX is stable, must not be in deps (Reanimated)
  }, [])

  const closeProfile = useCallback(
    (velocity = 0, onAfterClose?: () => void) => {
      'worklet'
      translateX.value = withSpring(
        SCREEN_WIDTH,
        {
          ...SNAP_BRAKE_CONFIG,
          velocity,
        },
        (finished) => {
          'worklet'
          if (finished && onAfterClose) {
            runOnJS(onAfterClose)()
          }
        },
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateX is stable, must not be in deps (Reanimated)
    [],
  )

  /**
   * Reset force — gọi từ useFocusEffect khi profile gains focus.
   * Đảm bảo translateX luôn = 0 khi profile được hiển thị, tránh stuck state
   * do gesture bị cancel mid-way (rapid tab switch gây touch leak + cancel).
   */
  const resetPosition = useCallback(() => {
    translateX.value = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateX is stable
  }, [])

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-ACTIVATION_OFFSET, ACTIVATION_OFFSET])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          'worklet'
          // Guard: chỉ update khi gesture bắt đầu từ edge area (32px từ cạnh trái)
          // HOẶC translateX đã > 0 (đang trong gesture). Ngăn touch leak từ tab bar
          // (pointerEvents: box-none) ở giữa/dưới màn drift translateX trong rapid tap.
          if (translateX.value === 0 && event.absoluteX > EDGE_ACTIVATION_AREA)
            return
          const nextX = translateX.value + event.translationX
          const resistedX = applyResistance(nextX, SCREEN_WIDTH)
          translateX.value = Math.min(SCREEN_WIDTH, Math.max(0, resistedX))
        })
        .onEnd((event, success) => {
          'worklet'
          // Cancelled (gesture interrupt từ tab switch, native stack gesture, v.v.):
          // snap về 0 để tránh stuck state ở intermediate value.
          if (!success) {
            translateX.value = withSpring(0, SNAP_BRAKE_CONFIG)
            return
          }
          const predictedX = translateX.value + event.velocityX * 0.18
          if (predictedX > SCREEN_WIDTH * 0.45) {
            closeProfile(event.velocityX, onBack)
          } else {
            openProfile()
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translateX is stable, must not be in deps (Reanimated)
    [openProfile, closeProfile, onBack],
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return { animatedStyle, openProfile, closeProfile, panGesture, resetPosition }
}
