/**
 * FavoriteButton — Nút Yêu thích (trái tim) với Wobble effect.
 * Khi nhấn: xoay -10° → 10° → 0° tạo hiệu ứng rung rinh sinh động.
 */

import { Heart } from 'lucide-react-native'
import React, { useCallback } from 'react'
import { Pressable, useColorScheme } from 'react-native'
import Animated, {
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'

import { SPRING_CONFIGS } from '@/constants'

const WOBBLE_DEG = 10

type Props = {
  isFavorite: boolean
  onToggle: () => void
  size?: number
  className?: string
}

export const FavoriteButton = React.memo(function FavoriteButton({
  isFavorite,
  onToggle,
  size = 24,
  className,
}: Props) {
  const isDark = useColorScheme() === 'dark'
  const rotation = useSharedValue(0)

  const handlePress = useCallback(() => {
    runOnUI(() => {
      'worklet'
      rotation.value = withSequence(
        withSpring(-WOBBLE_DEG, SPRING_CONFIGS.press),
        withSpring(WOBBLE_DEG, SPRING_CONFIGS.press),
        withSpring(0, SPRING_CONFIGS.press),
      )
    })()
    onToggle()
  }, [onToggle, rotation])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  const fillColor = isFavorite ? '#ef4444' : 'transparent'
  const strokeColor = isFavorite ? '#ef4444' : isDark ? '#9ca3af' : '#6b7280'

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      className={className}
      {...({ unstable_pressDelay: 0 } as object)}
    >
      <Animated.View style={animatedStyle}>
        <Heart
          size={size}
          color={strokeColor}
          fill={fillColor}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  )
})
