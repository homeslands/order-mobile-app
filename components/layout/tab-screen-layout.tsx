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
 * Chiều cao thanh tab gốc, KHÔNG gồm safe area đáy và KHÔNG gồm khoảng hở
 * nổi trên Android (xem ANDROID_FLOATING_TAB_BAR_MARGIN bên dưới).
 * Đo trên máy thật ngày 2026-09-20: iOS 49pt (chuẩn UIKit), Android 80dp
 * (chuẩn Material 3, đo bằng `uiautomator dump`).
 * Safe area của màn con KHÔNG chứa chiều cao này trên cả hai nền tảng —
 * đã kiểm bằng cách in `useSafeAreaInsets().bottom` ngay trong một tab.
 */
export const NATIVE_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 80

/**
 * Android: thanh tab giờ nổi, cách đáy safe area 10dp thay vì dính sát đáy —
 * khớp lề `bottom` đặt cho BottomNavigationView trong
 * patches/react-native-screens+4.16.0.patch (TabsHost.kt). iOS không đổi,
 * thanh tab vẫn dính đáy (giá trị này = 0).
 */
const ANDROID_FLOATING_TAB_BAR_MARGIN = Platform.OS === 'android' ? 10 : 0

/**
 * Hook trả về padding bottom chính xác theo thiết bị.
 *
 * - iPhone (iOS):      49 + insets.bottom (34 ở iPhone có home indicator)
 * - Android gesture:   80 + 10 (lề nổi) + insets.bottom (24 ở thanh cử chỉ)
 */
export function useTabBarBottomPadding(extra = 0): number {
  const { bottom } = useSafeAreaInsets()
  return (
    NATIVE_TAB_BAR_HEIGHT + ANDROID_FLOATING_TAB_BAR_MARGIN + bottom + extra
  )
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
