/**
 * TabScreenLayout — root wrapper cho tất cả tab screens.
 *
 * Chuẩn hoá:
 * - flex: 1 + backgroundColor đúng theme
 * - Không tự apply paddingTop (TabHeader tự quản lý STATIC_TOP_INSET)
 *
 * Bottom padding:
 *   Dùng hook `useTabBarBottomPadding()` trong ScrollView/FlashList
 *   contentContainerStyle để tính đúng theo từng thiết bị.
 *
 * Usage:
 *   const bottomPadding = useTabBarBottomPadding()
 *   <TabScreenLayout>
 *     <TabHeader variant="logo" rightActions={<NotificationBell />} />
 *     <ScrollView contentContainerStyle={{ paddingBottom: bottomPadding }}>
 *       ...
 *     </ScrollView>
 *   </TabScreenLayout>
 */
import React, { memo } from 'react'
import { Platform, StyleSheet, View, useColorScheme } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'

/**
 * Chiều cao thanh tab gốc, KHÔNG gồm safe area đáy.
 * Đo trên máy thật ngày 2026-09-20: iOS 49pt (chuẩn UIKit), Android 80dp
 * (chuẩn Material 3, đo bằng `uiautomator dump`).
 * Safe area của màn con KHÔNG chứa chiều cao này trên cả hai nền tảng —
 * đã kiểm bằng cách in `useSafeAreaInsets().bottom` ngay trong một tab.
 */
export const NATIVE_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 80

/**
 * Khoảng hở giữa đáy nút giỏ hàng nổi và đỉnh thanh tab.
 * Khớp với `cartButtonBottom` trong `app/(tabs)/_layout.tsx`.
 */
export const CART_BUTTON_BOTTOM_GAP = 12

/**
 * Kích thước nút giỏ hàng nổi (vuông, bo tròn).
 * Khớp với `buttonStyle.width`/`height` trong
 * `components/navigation/floating-cart-button.tsx`.
 */
export const CART_BUTTON_SIZE = 64

/**
 * Hook trả về padding bottom chính xác theo thiết bị.
 *
 * Nút giỏ hàng nổi neo tại `insets.bottom + NATIVE_TAB_BAR_HEIGHT +
 * CART_BUTTON_BOTTOM_GAP` và cao `CART_BUTTON_SIZE`, nên mép trên của nó nằm
 * cao hơn đỉnh thanh tab một khoảng `CART_BUTTON_BOTTOM_GAP + CART_BUTTON_SIZE`.
 * Nếu padding chỉ tính bằng chiều cao thanh tab, nội dung cuộn xuống cuối sẽ
 * bị nút che — nên phải lấy giá trị lớn hơn giữa hai mốc này.
 *
 * - iPhone (iOS):      49 + insets.bottom (34 ở iPhone có home indicator)
 * - Android gesture:   80 + insets.bottom (24 ở thanh cử chỉ)
 */
export function useTabBarBottomPadding(extra = 0): number {
  const { bottom } = useSafeAreaInsets()
  const cartButtonTopOffset =
    NATIVE_TAB_BAR_HEIGHT + CART_BUTTON_BOTTOM_GAP + CART_BUTTON_SIZE
  return Math.max(NATIVE_TAB_BAR_HEIGHT, cartButtonTopOffset) + bottom + extra
}

export interface TabScreenLayoutProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Override màu nền — mặc định lấy từ theme */
  backgroundColor?: string
}

export const TabScreenLayout = memo(function TabScreenLayout({
  children,
  style,
  backgroundColor,
}: TabScreenLayoutProps) {
  const isDark = useColorScheme() === 'dark'
  const bgColor =
    backgroundColor ??
    (isDark ? colors.background.dark : colors.background.light)

  return (
    <View style={[s.root, { backgroundColor: bgColor }, style]}>
      {children}
    </View>
  )
})

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
})
