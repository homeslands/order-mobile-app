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
 * Chiều cao thanh tab, KHÔNG gồm safe area đáy.
 *
 * iOS: 49pt — thanh tab gốc của hệ điều hành (chuẩn UIKit), đo trên máy thật
 * ngày 2026-09-20.
 * Android: 88 = BAR_HEIGHT(64) + BAR_PADDING(8) + VISUAL_GAP(10) + đệm fade(6)
 * của thanh tự vẽ — xem components/navigation/android-tabs-navigator.tsx.
 *
 * Safe area của màn con KHÔNG chứa chiều cao này trên cả hai nền tảng — đã
 * kiểm bằng cách in `useSafeAreaInsets().bottom` ngay trong một tab.
 */
export const NATIVE_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 88

/**
 * Hook trả về padding bottom chính xác theo thiết bị.
 *
 * - iPhone (iOS):      49 + insets.bottom (34 ở iPhone có home indicator)
 * - Android gesture:   88 + insets.bottom (24 ở thanh cử chỉ)
 */
export function useTabBarBottomPadding(extra = 0): number {
  const { bottom } = useSafeAreaInsets()
  return NATIVE_TAB_BAR_HEIGHT + bottom + extra
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
