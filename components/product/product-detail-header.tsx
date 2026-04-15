import { BlurView } from 'expo-blur'
import { ChevronLeft, ShoppingCart } from 'lucide-react-native'
import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'

const ICON_SIZE = 22
const ICON_COLOR_OVER = colors.white.light
const BLUR_INTENSITY = 28
const CIRCLE_OVERLAY_LIGHT = 'rgba(0,0,0,0.10)'
const CIRCLE_OVERLAY_DARK = 'rgba(0,0,0,0.22)'

/** Header row paddingTop — baked at module load, never changes. */
const HEADER_PADDING_TOP = STATIC_TOP_INSET + 6

type HeaderProps = {
  isDark: boolean
  onBack: () => void
  onCart: () => void
  cartCount: number
}

type HeaderAnimatedProps = HeaderProps & {
  fade: SharedValue<number>
}

// Dual-layer icon — cross-fade màu trắng ↔ theme trên UI thread
const DualColorIcon = React.memo(function DualColorIcon({
  fade,
  isDark,
  render,
}: {
  fade: SharedValue<number>
  isDark: boolean
  render: (color: string) => React.ReactNode
}) {
  const overStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fade.value, [0, 0.6], [1, 0], 'clamp'),
  }))
  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fade.value, [0.4, 1], [0, 1], 'clamp'),
  }))
  const solidColor = isDark ? colors.gray[50] : colors.gray[900]

  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, overStyle]}>
        {render(ICON_COLOR_OVER)}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, solidStyle]}>
        {render(solidColor)}
      </Animated.View>
    </View>
  )
})

// BlurView circle — blur texture trên màu vỏ cũ (white/dark)
function BlurCircle({
  isDark,
  onPress,
  children,
}: {
  isDark: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  const overlay = isDark ? CIRCLE_OVERLAY_DARK : CIRCLE_OVERLAY_LIGHT

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={BLUR_INTENSITY}
        tint={isDark ? 'dark' : 'light'}
        style={styles.circle}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
        <Pressable onPress={onPress} style={styles.circleInner} hitSlop={8}>
          {children}
        </Pressable>
      </BlurView>
    )
  }
  // Android: gray semi-transparent circle (no native blur)
  return (
    <View style={[styles.circle, { backgroundColor: overlay }]}>
      <Pressable onPress={onPress} style={styles.circleInner} hitSlop={8}>
        {children}
      </Pressable>
    </View>
  )
}

// ─── Simple (non-focused) ─────────────────────────────────────────────────────

export function ProductDetailHeaderSimple({ isDark, onBack, onCart, cartCount }: HeaderProps) {
  const iconColor = isDark ? colors.gray[50] : colors.gray[900]

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="auto">
        <BlurCircle isDark={isDark} onPress={onBack}>
          <ChevronLeft size={ICON_SIZE} color={iconColor} />
        </BlurCircle>
        <View>
          <BlurCircle isDark={isDark} onPress={onCart}>
            <ShoppingCart size={ICON_SIZE} color={iconColor} />
          </BlurCircle>
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

// ─── Animated (focused) ───────────────────────────────────────────────────────

export function ProductDetailHeaderAnimated({
  isDark,
  onBack,
  onCart,
  cartCount,
  fade,
}: HeaderAnimatedProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="auto">
        <BlurCircle isDark={isDark} onPress={onBack}>
          <DualColorIcon fade={fade} isDark={isDark} render={(c) => <ChevronLeft size={ICON_SIZE} color={c} />} />
        </BlurCircle>
        <View>
          <BlurCircle isDark={isDark} onPress={onCart}>
            <DualColorIcon fade={fade} isDark={isDark} render={(c) => <ShoppingCart size={ICON_SIZE} color={c} />} />
          </BlurCircle>
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  circleInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.destructive.light,
    borderWidth: 1.5,
    borderColor: colors.white.light,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white.light,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
})
