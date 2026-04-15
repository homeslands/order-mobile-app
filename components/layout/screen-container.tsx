/**
 * ScreenContainer — Dùng useSafeAreaInsets thay SafeAreaView.
 *
 * Tránh jumping/flicker UI trong Native Stack transition (SafeAreaView có thể
 * re-layout khi insets update async). Padding từ insets ổn định hơn.
 *
 * @see docs/SAFEAREA_NATIVE_STACK_REVIEW.md
 */
import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type Edge = 'top' | 'bottom' | 'left' | 'right'

export type ScreenContainerProps = {
  children: React.ReactNode
  /** Edges cần apply insets. Mặc định ['top'] cho màn stack. */
  edges?: Edge[]
  /** Điều chỉnh padding top (px). Âm = nhích lên gần status bar hơn. */
  topOffset?: number
  style?: StyleProp<ViewStyle>
  className?: string
}

/**
 * Wrapper áp dụng safe area insets qua padding.
 * Dùng thay SafeAreaView để tránh jump trong transition.
 */
export function ScreenContainer({
  children,
  edges = ['top'],
  topOffset = 0,
  style,
  className,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets()

  const paddingStyle: ViewStyle = {
    flex: 1,
    paddingTop: edges.includes('top') ? Math.max(0, insets.top + topOffset) : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  }

  return (
    <View style={[paddingStyle, style]} className={className}>
      {children}
    </View>
  )
}
