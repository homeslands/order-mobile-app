/**
 * AnimatedTabBar — Glassmorphism pill, sliding indicator khi chuyển tab.
 */
import { BlurView } from 'expo-blur'
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

  const tabConfigs = useMemo(
    () => [
      { Icon: Home, href: tabRoutes.home, label: t('tabs.home', 'Trang chủ') },
      { Icon: Menu, href: tabRoutes.menu, label: t('tabs.menu', 'Thực đơn') },
      { Icon: Gift, href: tabRoutes.giftCard, label: t('tabs.giftCard', 'Thẻ quà') },
      { Icon: User, href: tabRoutes.profile, label: t('tabs.profile', 'Tài khoản') },
    ],
    [tabRoutes, t],
  )

  const isActive = [
    tabState.isHomeActive,
    tabState.isMenuActive,
    tabState.isGiftCardActive,
    tabState.isProfileActive,
  ]

  return (
    <View style={styles.tabBar}>
      {/* shadowWrapper ngoài overflow:hidden để iOS không clip shadow */}
      <View style={[styles.shadowWrapper, { backgroundColor: colors.card }]}>
        {/* glassPill clip blur vào hình pill */}
        <View style={styles.glassPill} onLayout={onPillLayout}>
          <BlurView intensity={24} tint="default" style={StyleSheet.absoluteFill} />

          {/* Lớp màu mờ — giữ nhận diện màu theme, không che hết blur */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.card, opacity: 0.38 },
            ]}
          />

          {/* Viền trắng mỏng đều quanh — đặc trưng glassmorphism */}
          <View style={styles.glassBorder} pointerEvents="none" />

          {/* Content */}
          <View style={[styles.pillContent, { paddingHorizontal: paddingH }]}>
            <Animated.View
              style={[
                styles.slidingIndicator,
                { width: itemWidth, backgroundColor: colors.primary },
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
                indicatorX={indicatorX}
                buttonIndex={index}
                buttonPaddingH={paddingH}
                indicatorWidth={itemWidth}
              />
            ))}
          </View>
        </View>
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
  // Wrapper riêng để cast shadow — overflow:hidden clip mất shadow trên iOS
  shadowWrapper: {
    flex: 1,
    borderRadius: PILL_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  glassPill: {
    flex: 1,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  // Viền đều màu trắng mờ — glassmorphism signature
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
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
