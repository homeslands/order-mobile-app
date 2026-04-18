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
import { StyleSheet, View, useColorScheme } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'

/**
 * Chiều cao tab bar vật lý: BAR_HEIGHT(64) + BAR_PADDING(8) + MIN_GAP(8) + FADE buffer(8).
 * Đây là phần cố định — không phụ thuộc safe area.
 */
const TAB_BAR_HEIGHT = 88

/**
 * Hook trả về padding bottom chính xác theo thiết bị.
 * Tính bằng tab bar height + insets.bottom thực tế của device.
 *
 * - iPhone 16 Pro Max: 88 + 34 = 122
 * - iPhone SE:         88 + 0  = 88
 * - iPad:              88 + 20 = 108
 * - Android gesture:  88 + 24 = 112 (thay đổi theo system setting)
 */
export function useTabBarBottomPadding(extra = 0): number {
  const { bottom } = useSafeAreaInsets()
  return TAB_BAR_HEIGHT + bottom + extra
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
