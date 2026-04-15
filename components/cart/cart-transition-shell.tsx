/**
 * Shell nhẹ trong lúc transition Product Detail → Cart.
 * Header blur + skeleton — đồng bộ với CartContentFull (Skeleton-First, Logic-Later).
 * hideFooter: Content hiện footer thật ngay (Tầng 1) → không cần skeleton footer trùng.
 */
import { colors } from '@/constants'
import React from 'react'
import { View } from 'react-native'

import { CART_HEADER_CONTENT_HEIGHT, CartHeaderBlur } from './cart-header-blur'
import CartSkeleton from './cart-skeleton'
import { cn } from '@/utils/cn'

type CartTransitionShellProps = {
  onBack: () => void
  isDark?: boolean
  insets?: { top: number; bottom: number }
  title?: string
}

export function CartTransitionShell({
  onBack,
  isDark = false,
  insets = { top: 0, bottom: 0 },
}: CartTransitionShellProps) {
  const bgClass = isDark ? 'bg-gray-900' : colors.background.light
  const headerHeight = insets.top + CART_HEADER_CONTENT_HEIGHT

  return (
    <View
      style={{ flex: 1, paddingBottom: insets.bottom }}
      className={cn('flex-1', bgClass)}
    >
      <CartHeaderBlur onBack={onBack} orderCount={0} isDark={isDark} />
      <View style={{ flex: 1, paddingTop: headerHeight }}>
        <CartSkeleton isDark={isDark} insets={insets} hideFooter />
      </View>
    </View>
  )
}
