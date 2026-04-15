/**
 * MapsPressable — Zero-delay Pressable cho navigation.
 *
 * Dùng react-native-gesture-handler Pressable với:
 * - delayPressIn={0} (qua unstable_pressDelay)
 * - unstable_pressDelay={0}
 *
 * Đảm bảo onPress fire ngay, tránh lost tap.
 * __DEV__: trace onPress để đo latency Press -> Router Push.
 */
import type { ComponentProps } from 'react'
import React from 'react'
import { Pressable } from 'react-native-gesture-handler'

type MapsPressableProps = ComponentProps<typeof Pressable>

/**
 * Pressable tối ưu cho navigation: zero delay, immediate execution.
 * Dùng thay TouchableOpacity/Pressable cho các nút navigation.
 */
export const MapsPressable = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  MapsPressableProps
>(function MapsPressable({ onPress, onPressIn, onPressOut, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      {...props}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      delayLongPress={500}
      unstable_pressDelay={0}
    />
  )
})
