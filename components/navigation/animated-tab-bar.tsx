/**
 * AnimatedTabBar — Pill full width, sliding indicator khi chuyển tab.
 */
import type { TFunction } from 'i18next'
import { Gift, Home, Menu, User } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { SPRING_CONFIGS } from '@/constants'
import { AnimatedTabButton } from './animated-tab-button'

const ICON_SIZE = 32
const ITEM_WIDTH = 70
const PADDING_V = 4
const CONTENT_HEIGHT = 32 + 14 + 12
const PILL_RADIUS = (PADDING_V * 2 + CONTENT_HEIGHT) / 2
const PADDING_H_DEFAULT = 10


type Colors = {
  primary: string
  mutedForeground: string
  background: string
  card: string
}

type AnimatedTabBarProps = {
  t: TFunction<'tabs'>
  colors: Colors
  tabState: {
    isHomeActive: boolean
    isMenuActive: boolean
    isGiftCardActive: boolean
    isProfileActive: boolean
  }
  tabRoutes: {
    home: string
    menu: string
    giftCard: string
    profile: string
  }
  /** Gọi ngay khi finger down — prefetch không block. */
  onPressInTabSwitch?: (href: string) => void
}

export const AnimatedTabBar = React.memo(function AnimatedTabBar({
  t,
  colors,
  tabState,
  tabRoutes,
  onPressInTabSwitch,
}: AnimatedTabBarProps) {
  const [layout, setLayout] = useState({ pillWidth: 0, paddingH: PADDING_H_DEFAULT })
  const { pillWidth, paddingH } = layout
  const indicatorX = useSharedValue(0)
  const hasAnimatedRef = useRef(false)

  // activeIndex = -1 khi user ở route không thuộc tab nào (vd: /cart,
  // /update-order/xxx, /payment/xxx). Trong trường hợp đó, indicator giữ
  // position cũ thay vì nhảy về Home (fallback behavior cũ gây desync).
  const activeIndex = tabState.isHomeActive
    ? 0
    : tabState.isMenuActive
      ? 1
      : tabState.isGiftCardActive
        ? 2
        : tabState.isProfileActive
          ? 3
          : -1

  const itemWidth = pillWidth > 0 ? (pillWidth - 2 * paddingH) / 4 : ITEM_WIDTH

  useEffect(() => {
    // Skip nếu chưa layout hoặc không match tab nào (giữ position cũ).
    if (pillWidth <= 0 || activeIndex < 0) return
    const targetX = paddingH + activeIndex * itemWidth
    if (!hasAnimatedRef.current) {
      indicatorX.value = targetX
      hasAnimatedRef.current = true
    } else {
      indicatorX.value = withSpring(targetX, SPRING_CONFIGS.tabIndicator)
    }
  }, [activeIndex, paddingH, itemWidth, pillWidth, indicatorX])

  const onPillLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) {
      const ph = Math.max(4, Math.min((8 * PILL_RADIUS - w) / 6, 20))
      setLayout({ pillWidth: w, paddingH: ph })
    }
  }, [])

  const slidingIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }))

  // Static config — no tabState dep; rebuilds only when routes/translations change
  const tabConfigs = useMemo(
    () => [
      { Icon: Home, href: tabRoutes.home, label: t('tabs.home', 'Trang chủ') },
      { Icon: Menu, href: tabRoutes.menu, label: t('tabs.menu', 'Thực đơn') },
      { Icon: Gift, href: tabRoutes.giftCard, label: t('tabs.giftCard', 'Thẻ quà') },
      { Icon: User, href: tabRoutes.profile, label: t('tabs.profile', 'Tài khoản') },
    ],
    [tabRoutes, t],
  )

  // Active flags indexed to match tabConfigs order
  const isActive = [
    tabState.isHomeActive,
    tabState.isMenuActive,
    tabState.isGiftCardActive,
    tabState.isProfileActive,
  ]

  return (
    <View style={[styles.tabBar, { backgroundColor: 'transparent' }]}>
      <View
        style={[
          styles.pill,
          { paddingHorizontal: paddingH, backgroundColor: colors.card },
        ]}
        onLayout={onPillLayout}
      >
        <Animated.View
          style={[
            styles.slidingIndicator,
            {
              width: itemWidth,
              backgroundColor: colors.primary,
            },
            slidingIndicatorStyle,
          ]}
        />
        {tabConfigs.map(({ Icon, href, label }, index) => (
          <AnimatedTabButton
            key={href}
            iconSize={ICON_SIZE}
            itemWidth={ITEM_WIDTH}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive[index]}
            mutedColor={colors.mutedForeground}
            onPressIn={onPressInTabSwitch}
          />
        ))}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 9999,
    paddingVertical: PADDING_V,
    position: 'relative',
  },
  slidingIndicator: {
    position: 'absolute',
    left: 0,
    top: PADDING_V,
    bottom: PADDING_V,
    borderRadius: 9999,
  },
})
