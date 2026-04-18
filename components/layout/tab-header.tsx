/**
 * TabHeader — shared header cho tất cả tab screens.
 *
 * - variant 'logo': hiện brand logo (Home tab)
 * - variant 'title': hiện text title (Menu, Cart, Gift Card...)
 * - Dùng STATIC_TOP_INSET — không hook, không re-render khi insets thay đổi
 * - rightActions: slot cho NotificationBell, filter icons, cart icon, v.v.
 * - Nhận animatedStyle + borderAnimatedStyle để hỗ trợ scroll-driven collapse
 *
 * Stack screens → dùng FloatingHeader thay thế.
 */
import { Image } from 'expo-image'
import React, { memo } from 'react'
import { StyleSheet, Text, View, useColorScheme } from 'react-native'
import Animated from 'react-native-reanimated'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { StyleProp, ViewStyle } from 'react-native'

import { Images } from '@/assets/images'
import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'

export interface TabHeaderProps {
  /** 'logo' = brand logo (Home), 'title' = text title (Menu, Cart...) */
  variant: 'logo' | 'title'
  title?: string
  /** Slot bên phải — NotificationBell, filter icons, v.v. */
  rightActions?: React.ReactNode
  /** Animated style cho toàn bộ header (dùng cho scroll-driven collapse) */
  animatedStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
  /** Animated style cho border bottom (fade in/out theo scroll) */
  borderAnimatedStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
}

const LOGO_WIDTH = 120
const LOGO_HEIGHT = 32
const HEADER_PADDING_H = 16
const HEADER_PADDING_BOTTOM = 12
const HEADER_PADDING_TOP = 4

export const TabHeader = memo(function TabHeader({
  variant,
  title,
  rightActions,
  animatedStyle,
  borderAnimatedStyle,
}: TabHeaderProps) {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : colors.background.light
  const titleColor = isDark ? colors.foreground.dark : colors.foreground.light
  const borderColor = isDark ? colors.border.dark : colors.border.light

  return (
    <View
      style={[
        s.root,
        { backgroundColor: bgColor, paddingTop: STATIC_TOP_INSET },
      ]}
    >
      <Animated.View style={[s.row, animatedStyle]}>
        {/* Left — logo or title */}
        {variant === 'logo' ? (
          <Image
            source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
            style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
            contentFit="contain"
            cachePolicy="memory"
          />
        ) : (
          <Text style={[s.title, { color: titleColor }]} numberOfLines={1}>
            {title ?? ''}
          </Text>
        )}

        {/* Right actions */}
        {rightActions != null && <View style={s.actions}>{rightActions}</View>}
      </Animated.View>

      {/* Border bottom — có thể animate opacity theo scroll */}
      <Animated.View
        style={[
          s.border,
          { backgroundColor: borderColor },
          borderAnimatedStyle,
        ]}
      />
    </View>
  )
})

const s = StyleSheet.create({
  root: {
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HEADER_PADDING_H,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: HEADER_PADDING_BOTTOM,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  border: {
    height: StyleSheet.hairlineWidth,
  },
})
