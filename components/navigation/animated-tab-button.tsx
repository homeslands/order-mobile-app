import type { LucideIcon } from 'lucide-react-native'
import React, { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import { NativeGesturePressable } from './native-gesture-pressable'

type AnimatedTabButtonProps = {
  href: string
  iconSize?: number
  itemWidth?: number
  label?: string
  Icon: LucideIcon
  active: boolean
  mutedColor: string
  onPressIn?: (href: string) => void
  // UI-thread animation — passed from AnimatedTabBar
  indicatorX: SharedValue<number>
  buttonIndex: number
  buttonPaddingH: number
  indicatorWidth: number
}

export const AnimatedTabButton = React.memo(function AnimatedTabButton({
  href,
  iconSize = 36,
  itemWidth = 70,
  label,
  Icon,
  active,
  mutedColor,
  onPressIn,
  indicatorX,
  buttonIndex,
  buttonPaddingH,
  indicatorWidth,
}: AnimatedTabButtonProps) {
  const handlePressIn = useCallback(() => {
    onPressIn?.(href)
  }, [href, onPressIn])

  // 1 when indicator covers this button, 0 when ≥1 slot away — all on UI thread
  const activeFraction = useDerivedValue(() => {
    const buttonLeft = buttonPaddingH + buttonIndex * indicatorWidth
    const dist = Math.abs(indicatorX.value - buttonLeft)
    return interpolate(dist, [0, indicatorWidth], [1, 0], Extrapolation.CLAMP)
  })

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: activeFraction.value * -3 },
      { scale: 1 + activeFraction.value * 0.06 },
    ],
  }))

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeFraction.value,
      [0, 1],
      [mutedColor, '#ffffff'],
    ),
  }))

  const activeIconOpacity = useAnimatedStyle(() => ({
    opacity: activeFraction.value,
  }))

  const mutedIconOpacity = useAnimatedStyle(() => ({
    opacity: 1 - activeFraction.value,
  }))

  const iconPx = iconSize * 0.55

  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      onPressIn={handlePressIn}
      disabled={active}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { width: itemWidth }, liftStyle]}>
        {/* Cross-fade two icons so strokes never overlap — avoids dark fringing */}
        <View style={{ width: iconPx, height: iconPx }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.iconOverlay,
              mutedIconOpacity,
            ]}
          >
            <Icon color={mutedColor} size={iconPx} />
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.iconOverlay,
              activeIconOpacity,
            ]}
          >
            <Icon color="#ffffff" size={iconPx} />
          </Animated.View>
        </View>
        {label ? (
          <Animated.Text
            style={[styles.label, { maxWidth: itemWidth - 20 }, labelStyle]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </NativeGesturePressable>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  iconOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
