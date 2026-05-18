/**
 * AnimatedTabBar — Liquid glass pill, stretchy liquid indicator khi chuyển tab.
 */
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import type { TFunction } from 'i18next'
import { Gift, Home, Menu, User } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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

// Spring cho cạnh dẫn đầu (nhanh, ít bounce)
const LEAD_SPRING = { damping: 28, stiffness: 420, mass: 0.85 }

export const AnimatedTabBar = React.memo(function AnimatedTabBar({
  t,
  colors,
  tabState,
  tabRoutes,
  onPressInTabSwitch,
}: AnimatedTabBarProps) {
  const [layout, setLayout] = useState({ pillWidth: 0, paddingH: PADDING_H_DEFAULT })
  const { pillWidth, paddingH } = layout

  // Color cross-fade trong AnimatedTabButton: spring ngay đến target
  const indicatorX = useSharedValue(0)

  // Visual liquid indicator: leftEdge / rightEdge di chuyển lệch pha
  const leftEdge = useSharedValue(PADDING_H_DEFAULT)
  const rightEdge = useSharedValue(PADDING_H_DEFAULT + ITEM_WIDTH)

  const hasAnimatedRef = useRef(false)
  const prevActiveIndexRef = useRef(-1)

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
    const toX = paddingH + activeIndex * itemWidth
    const toRight = toX + itemWidth
    const prevIndex = prevActiveIndexRef.current
    prevActiveIndexRef.current = activeIndex

    // Color cross-fade luôn spring ngay — không chờ liquid
    indicatorX.value = withSpring(toX, SPRING_CONFIGS.tabIndicator)

    if (!hasAnimatedRef.current) {
      leftEdge.value = toX
      rightEdge.value = toRight
      hasAnimatedRef.current = true
      return
    }

    if (prevIndex >= 0 && prevIndex !== activeIndex) {
      if (activeIndex > prevIndex) {
        // Di chuyển phải: cạnh phải dẫn, cạnh trái theo sau
        rightEdge.value = withSpring(toRight, LEAD_SPRING)
        leftEdge.value = withDelay(85, withSpring(toX, SPRING_CONFIGS.tabIndicator))
      } else {
        // Di chuyển trái: cạnh trái dẫn, cạnh phải theo sau
        leftEdge.value = withSpring(toX, LEAD_SPRING)
        rightEdge.value = withDelay(85, withSpring(toRight, SPRING_CONFIGS.tabIndicator))
      }
    } else {
      leftEdge.value = withSpring(toX, SPRING_CONFIGS.tabIndicator)
      rightEdge.value = withSpring(toRight, SPRING_CONFIGS.tabIndicator)
    }
  }, [activeIndex, paddingH, itemWidth, pillWidth, indicatorX, leftEdge, rightEdge])

  const onPillLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) {
      const ph = Math.max(4, Math.min((8 * PILL_RADIUS - w) / 6, 20))
      setLayout({ pillWidth: w, paddingH: ph })
    }
  }, [])

  const slidingIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftEdge.value }],
    width: rightEdge.value - leftEdge.value,
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
      {/* overflow hidden clips blur + border-radius trên cả hai nền tảng */}
      <View style={styles.pillContainer} onLayout={onPillLayout}>
        {/* ── Glass layers ─────────────────────────────────────────────── */}
        <BlurView intensity={22} tint="default" style={StyleSheet.absoluteFill} />

        {/* Tint để pill không bị trong suốt hoàn toàn */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.card, opacity: 0.52 },
          ]}
        />

        {/* Specular highlight — ánh sáng dọc từ trên xuống */}
        <LinearGradient
          colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Viền kính mỏng */}
        <View style={styles.glassBorder} pointerEvents="none" />

        {/* ── Content ──────────────────────────────────────────────────── */}
        <View style={[styles.pillContent, { paddingHorizontal: paddingH }]}>
          {/* Liquid sliding indicator */}
          <Animated.View style={[styles.slidingIndicator, slidingIndicatorStyle]}>
            {/* Màu chủ đạo */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.primary, borderRadius: 9999 },
              ]}
            />
            {/* Specular trên indicator — tạo hiệu ứng 3D kính */}
            <LinearGradient
              colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 0.55 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 9999 }]}
              pointerEvents="none"
            />
          </Animated.View>

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
  )
})

const styles = StyleSheet.create({
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    flex: 1,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
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
    overflow: 'hidden',
  },
})
