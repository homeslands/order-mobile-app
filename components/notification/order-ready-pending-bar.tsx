/**
 * OrderReadyPendingBar — persistent ambient bar shown when the customer opens
 * the app via icon and has an unread ORDER_NEEDS_READY_TO_GET notification.
 *
 * No push notification tap needed. The bar reads the Zustand notification store
 * directly so it appears / disappears reactively as read-state changes.
 *
 * Tap bar  → markAsRead + navigate to order detail
 * Tap ✕    → markAsRead only (dismiss without navigating)
 */
import { X } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors } from '@/constants'
import { NotificationMessageCode } from '@/constants/notification.constant'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'
import { useNotificationStore } from '@/stores/notification.store'

export const OrderReadyPendingBar = memo(function OrderReadyPendingBar() {
  const pendingSlug = useNotificationStore((s) =>
    s.notifications.find(
      (n) =>
        !n.isRead &&
        n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
    )?.slug ?? null,
  )

  const pendingOrderSlug = useNotificationStore((s) =>
    pendingSlug
      ? (s.notifications.find((n) => n.slug === pendingSlug)?.metadata.order ??
          null)
      : null,
  )

  const markAsRead = useNotificationStore((s) => s.markAsRead)

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
  }, [pendingSlug, markAsRead])

  if (!pendingSlug) return null

  const primaryColor = colors.primary.light
  const textColor = colors.white.light

  return (
    <Pressable
      onPress={handleBarPress}
      style={[s.bar, { top: STATIC_TOP_INSET, backgroundColor: primaryColor }]}
      accessibilityRole="button"
      accessibilityLabel="Đơn hàng đã sẵn sàng — Nhấn để xem chi tiết"
    >
      <Text style={[s.message, { color: textColor }]} numberOfLines={1}>
        Đơn hàng của bạn đã sẵn sàng! Đến lấy ngay nhé 🎉
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
  )
})

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
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
