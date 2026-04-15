/**
 * Phase 7.5 — NavigatePressable.
 * Pressable với unstable_pressDelay=0, tránh lost press event.
 * Dùng thay TouchableOpacity cho các nút navigation.
 */
import type { ComponentProps } from 'react'
import React from 'react'
import { Pressable } from 'react-native'

type NavigatePressableProps = ComponentProps<typeof Pressable>

/**
 * Pressable tối ưu cho navigation: unstable_pressDelay=0, không delay.
 * Tránh tap bị ignore khi user bấm nhanh.
 */
export const NavigatePressable = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  NavigatePressableProps
>(function NavigatePressable(props, ref) {
  return (
    <Pressable
      ref={ref}
      {...props}
      {...({ unstable_pressDelay: 0 } as Partial<NavigatePressableProps>)}
    />
  )
})
