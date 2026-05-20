/**
 * OrderReadyPendingBar — persistent ambient bar shown when the customer opens
 * the app via icon and has an unread ORDER_NEEDS_READY_TO_GET notification.
 *
 * No push notification tap needed. The bar reads the Zustand notification store
 * directly so it appears / disappears reactively as read-state changes.
 *
 * Tap bar  → markAsRead + navigate to order detail
 * Tap ✕    → markAsRead + toast hint (not silent dismiss)
 *
 * Positioned below TabHeader so bell/logo/search remain visible.
 * Animates in/out with Reanimated withTiming + haptic on appear.
 */
import * as Haptics from 'expo-haptics'
import { X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import { TAB_HEADER_CONTENT_HEIGHT } from '@/components/layout/tab-header'
import { colors } from '@/constants'
import { NotificationMessageCode } from '@/constants/notification.constant'
import { TIMING_CONFIGS } from '@/constants/motion'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'
import { showToastInternal } from '@/providers/toast-provider'
import { useNotificationStore } from '@/stores/notification.store'

const BAR_TOP = STATIC_TOP_INSET + TAB_HEADER_CONTENT_HEIGHT

export const OrderReadyPendingBar = memo(function OrderReadyPendingBar() {
  const { pendingSlug, pendingOrderSlug } = useNotificationStore(
    useShallow((s) => {
      const n = s.notifications.find(
        (n) =>
          !n.isRead &&
          n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      )
      return {
        pendingSlug: n?.slug ?? null,
        pendingOrderSlug: n?.metadata.order ?? null,
      }
    }),
  )

  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const isDark = useColorScheme() === 'dark'

  const visible = pendingSlug !== null
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-40)
  const hapticFiredForSlug = useRef<string | null>(null)

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, TIMING_CONFIGS.bannerSlide)
      translateY.value = withTiming(0, TIMING_CONFIGS.bannerSlide)
      if (pendingSlug !== hapticFiredForSlug.current) {
        hapticFiredForSlug.current = pendingSlug
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {})
      }
    } else {
      hapticFiredForSlug.current = null
      opacity.value = withTiming(0, TIMING_CONFIGS.bannerSlide)
      translateY.value = withTiming(-40, TIMING_CONFIGS.bannerSlide)
    }
  }, [visible, pendingSlug, opacity, translateY])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const handleBarPress = useCallback(() => {
    if (!pendingSlug) return
    markAsRead(pendingSlug)
    if (pendingOrderSlug) {
      navigateNative.push(`/order/${pendingOrderSlug}`)
    }
  }, [pendingSlug, pendingOrderSlug, markAsRead])

  const handleDismiss = useCallback(() => {
    if (!pendingSlug) return
    markAsRead(pendingSlug)
    showToastInternal('Đã ẩn nhắc nhở', 'Đã ẩn nhắc nhở — Xem lại ở mục Thông báo', 'info')
  }, [pendingSlug, markAsRead])

  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const textColor = colors.white.light

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[s.wrapper, { top: BAR_TOP }, animatedStyle]}
    >
      <Pressable
        style={[s.bar, { backgroundColor: primaryColor }]}
        onPress={handleBarPress}
        accessibilityRole="button"
        accessibilityLabel="Đơn hàng đã sẵn sàng — Nhấn để xem chi tiết"
      >
        <Text style={[s.message, { color: textColor }]} numberOfLines={1}>
          Đơn đã sẵn sàng — nhận ngay 🎉
        </Text>
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          style={s.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo"
        >
          <X size={16} color={textColor} />
        </Pressable>
      </Pressable>
    </Animated.View>
  )
})

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
