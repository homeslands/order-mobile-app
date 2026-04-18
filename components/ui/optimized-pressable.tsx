/**
 * OptimizedPressable — Pressable tối ưu cho phản hồi nhanh (Telegram-style).
 *
 * - unstable_pressDelay: 0 — giảm độ trễ từ chạm đến phản hồi
 * - hitSlop mặc định cho nút nhỏ — tăng vùng nhận diện, tránh bấm hụt
 *
 * Dùng thay TouchableOpacity cho các nút không phải navigation.
 * Cho navigation: dùng NavigatePressable hoặc NativeGesturePressable.
 */
import type { ComponentProps } from 'react'
import React from 'react'
import { Pressable } from 'react-native'

import { HIT_SLOP_SMALL } from '@/lib/navigation/constants'

export type OptimizedPressableProps = ComponentProps<typeof Pressable> & {
  /** Nút nhỏ (icon, +/-) — thêm hitSlop mặc định */
  small?: boolean
}

export const OptimizedPressable = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  OptimizedPressableProps
>(function OptimizedPressable({ small = false, hitSlop, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      {...props}
      hitSlop={hitSlop ?? (small ? HIT_SLOP_SMALL : undefined)}
      {...({ unstable_pressDelay: 0 } as Partial<
        ComponentProps<typeof Pressable>
      >)}
    />
  )
})
