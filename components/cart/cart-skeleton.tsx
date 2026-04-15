/**
 * Skeleton placeholder khi Cart defer mount (Product Detail → Cart transition).
 * Layout khớp 100% với CartItemRow + footer — tránh jump khi chuyển skeleton → UI thật.
 * List và footer hiện cùng lúc. Footer position absolute cố định ở bottom.
 * Nhẹ: chỉ View, không Animated, không FlatList.
 */
import React from 'react'
import { View } from 'react-native'

import { cn } from '@/utils/cn'

interface CartSkeletonProps {
  isDark?: boolean
  /** Safe area insets — footer dùng để cố định bottom + padding đúng */
  insets?: { top?: number; bottom?: number }
  /** Ẩn footer skeleton — khi parent (CartContentFull) hiện footer thật ngay (Tầng 1) */
  hideFooter?: boolean
}

const SKELETON_ROWS = 4
/** Chiều cao footer (pt-3 + mb-3+dropdowns + voucher + mt-3+total) ~ 180px */
const FOOTER_CONTENT_HEIGHT = 180

export default function CartSkeleton({
  isDark,
  insets,
  hideFooter = false,
}: CartSkeletonProps) {
  const bgClass = isDark ? 'bg-gray-700' : 'bg-gray-200'
  const bottomInset = insets?.bottom ?? 0
  const footerPaddingBottom = Math.max(bottomInset, 16) + 8

  return (
    <View className="flex-1 pt-2">
      {/* List rows — paddingBottom để không bị footer che */}
      <View
        className="flex-1"
        style={{ paddingBottom: FOOTER_CONTENT_HEIGHT + footerPaddingBottom }}
      >
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <View key={i} className="px-4 py-2">
            <View className="overflow-hidden rounded-xl bg-white dark:bg-gray-900">
              <View className="flex-row gap-3 p-3">
                <View
                  className={cn(
                    'h-20 w-20 overflow-hidden rounded-lg',
                    bgClass,
                  )}
                />
                <View className="flex-1 min-w-0">
                  <View className={cn('h-7 w-32 rounded', bgClass)} />
                  <View
                    className={cn(
                      'mt-1 h-6 w-20 self-start rounded-full',
                      bgClass,
                    )}
                  />
                  <View className="mt-2 flex-row items-end justify-between">
                    <View className={cn('h-4 w-16 rounded', bgClass)} />
                    <View className={cn('h-9 w-24 rounded-full', bgClass)} />
                  </View>
                </View>
              </View>
              <View
                className={cn(
                  'flex-row items-center gap-2.5 border-t border-gray-100 px-3 pb-3 pt-2 dark:border-gray-700',
                )}
              >
                <View className={cn('h-5 w-5 shrink-0 rounded', bgClass)} />
                <View className={cn('h-10 min-w-0 flex-1 rounded', bgClass)} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {!hideFooter && (
        <View
          className={cn(
            'absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 pt-3 dark:border-gray-700 dark:bg-gray-800',
          )}
          style={{ paddingBottom: footerPaddingBottom }}
        >
          <View className="mb-3 flex-row gap-3">
            <View className={cn('h-11 flex-1 rounded-md', bgClass)} />
            <View className={cn('h-11 flex-1 rounded-md', bgClass)} />
          </View>
          <View className={cn('h-14 w-full rounded-xl', bgClass)} />
          <View className="mt-3 flex-row items-center justify-between">
            <View className={cn('h-8 w-24 rounded', bgClass)} />
            <View className={cn('h-11 w-28 rounded-md', bgClass)} />
          </View>
        </View>
      )}
    </View>
  )
}
