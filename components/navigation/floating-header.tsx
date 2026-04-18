/**
 * FloatingHeader — reusable blur+gradient floating header.
 *
 * Pattern used by: cart, order history, payment, notification.
 * Back button (left) + centered title + optional right element.
 * BlurView (iOS) + LinearGradient fade, absolute positioned.
 */
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronLeft } from 'lucide-react-native'
import React, { memo, useMemo } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'

import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'

interface FloatingHeaderProps {
  title: string
  onBack?: () => void
  rightElement?: React.ReactNode
  /** iOS only: bỏ BlurView, chỉ dùng LinearGradient fade thuần */
  disableBlur?: boolean
}

export const FloatingHeader = memo(function FloatingHeader({
  title,
  onBack,
  rightElement,
  disableBlur = false,
}: FloatingHeaderProps) {
  const isDark = useColorScheme() === 'dark'
  const pageBg = isDark ? colors.background.dark : colors.background.light

  const gradientColors = useMemo(
    () =>
      [
        pageBg,
        `${pageBg}E6`,
        `${pageBg}B0`,
        `${pageBg}50`,
        `${pageBg}00`,
      ] as const,
    [pageBg],
  )

  const handleBack = onBack ?? navigateNative.back

  return (
    <View style={s.container} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* BlurView chỉ trên iOS — Android không hỗ trợ native blur, tinted layer
            sẽ che gradient fade. iOS đã đạt fade tốt với LinearGradient đơn thuần. */}
        {Platform.OS === 'ios' && !disableBlur && (
          <BlurView
            intensity={20}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.3, 0.62, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Title — absolute centered */}
      <View
        style={[s.titleWrap, { top: STATIC_TOP_INSET + 10 }]}
        pointerEvents="none"
      >
        <Text
          style={[
            s.title,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {/* Row: back + spacer + right */}
      <View
        style={[s.row, { paddingTop: STATIC_TOP_INSET + 10 }]}
        pointerEvents="auto"
      >
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          style={[
            s.circleBtn,
            { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
            s.shadow,
          ]}
        >
          <ChevronLeft
            size={20}
            color={isDark ? colors.gray[50] : colors.gray[900]}
          />
        </Pressable>

        {rightElement ?? <View style={s.circleBtn} />}
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 2,
  },
})
