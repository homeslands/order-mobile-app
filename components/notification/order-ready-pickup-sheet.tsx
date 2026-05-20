/**
 * OrderReadyPickupSheet — prominent bottom sheet notifying the customer that
 * their order is ready for pickup.
 *
 * Show conditions (all must be true):
 * - Unread ORDER_NEEDS_READY_TO_GET notification exists in store
 * - Pathname is NOT /payment/, /update-order/, or /order/ (payment screens get
 *   OrderReadyAmbientBar instead; order-detail is already showing the order)
 * - Notification slug NOT in dismissedInSession (Set cleared on app kill only)
 *
 * Dismiss behaviors:
 * - "Xem chi tiết đơn" → markAsRead + navigate + add to dismissedInSession
 * - "Để sau"           → markAsRead + toast  + add to dismissedInSession
 * - Swipe / scrim      → soft-dismiss (add to dismissedInSession, no markAsRead)
 *
 * isProgrammaticDismissRef prevents onDismiss from double-adding to
 * dismissedInSession when dismiss() is called from a button handler.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { usePathname } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { colors } from '@/constants'
import { NotificationMessageCode } from '@/constants/notification.constant'
import { navigateNative } from '@/lib/navigation'
import { showToastInternal } from '@/providers/toast-provider'
import { useNotificationStore } from '@/stores/notification.store'

const SNAP_POINTS = ['45%']

// Module-level: persists for JS runtime lifetime (cleared only on app kill).
const dismissedInSession = new Set<string>()

interface PendingOrder {
  slug: string
  orderSlug: string
  referenceNumber: string
  branchName: string
}

export const OrderReadyPickupSheet = memo(function OrderReadyPickupSheet() {
  const pathname = usePathname()
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

  const pendingOrder = useNotificationStore(
    useShallow((s): PendingOrder | null => {
      const n = s.notifications.find(
        (n) =>
          !n.isRead &&
          n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      )
      if (!n) return null
      return {
        slug: n.slug,
        orderSlug: n.metadata.order,
        referenceNumber: n.metadata.referenceNumber ?? '',
        branchName: n.metadata.branchName,
      }
    }),
  )

  const markAllReadByOrder = useNotificationStore((s) => s.markAllReadByOrder)

  const shouldSuppress = pathname?.startsWith('/order/')

  // Add every notification slug that shares the same orderSlug to
  // dismissedInSession so sibling duplicates (staff tapped multiple times)
  // don't re-present the sheet after the user has already interacted.
  const dismissAllByOrder = useCallback((orderSlug: string) => {
    useNotificationStore
      .getState()
      .notifications.filter(
        (n) =>
          n.metadata.order === orderSlug &&
          n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      )
      .forEach((n) => dismissedInSession.add(n.slug))
  }, [])

  const sheetRef = useRef<BottomSheetModal>(null)
  const shownSlugRef = useRef<string | null>(null)
  const isProgrammaticDismissRef = useRef(false)
  const pendingOrderRef = useRef<PendingOrder | null>(null)
  useEffect(() => {
    pendingOrderRef.current = pendingOrder
  }, [pendingOrder])

  useEffect(() => {
    const shouldShow =
      !!pendingOrder &&
      !shouldSuppress &&
      !dismissedInSession.has(pendingOrder.slug)

    if (shouldShow && shownSlugRef.current !== pendingOrder!.slug) {
      shownSlugRef.current = pendingOrder!.slug
      // Defer to next frame — on cold start, BottomSheetModal may not have
      // finished registering with the provider by the time this effect fires.
      requestAnimationFrame(() => {
        sheetRef.current?.present()
      })
    } else if (!shouldShow && shownSlugRef.current !== null) {
      isProgrammaticDismissRef.current = true
      sheetRef.current?.dismiss()
    }
  }, [pendingOrder, shouldSuppress])

  const handleSheetDismiss = useCallback(() => {
    if (!isProgrammaticDismissRef.current && pendingOrderRef.current) {
      dismissAllByOrder(pendingOrderRef.current.orderSlug)
    }
    isProgrammaticDismissRef.current = false
    shownSlugRef.current = null
  }, [dismissAllByOrder])

  const handleViewOrder = useCallback(() => {
    if (!pendingOrder) return
    dismissAllByOrder(pendingOrder.orderSlug)
    markAllReadByOrder(pendingOrder.orderSlug)
    isProgrammaticDismissRef.current = true
    sheetRef.current?.dismiss()
    if (pendingOrder.orderSlug) {
      navigateNative.push(`/order/${pendingOrder.orderSlug}`)
    }
  }, [pendingOrder, dismissAllByOrder, markAllReadByOrder])

  const handleDismissLater = useCallback(() => {
    if (!pendingOrder) return
    dismissAllByOrder(pendingOrder.orderSlug)
    isProgrammaticDismissRef.current = true
    sheetRef.current?.dismiss()
    showToastInternal(
      'Đã ẩn nhắc nhở',
      'Đã ẩn nhắc nhở — Xem lại ở mục Thông báo',
      'info',
    )
  }, [pendingOrder, dismissAllByOrder])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  )

  const bgStyle = useMemo(
    () => ({
      backgroundColor: isDark ? colors.card.dark : colors.white.light,
    }),
    [isDark],
  )

  const successColor = isDark ? colors.success.dark : colors.success.light
  const iconBg = isDark
    ? colors.success.iconBgDark
    : colors.success.iconBgLight
  const titleColor = isDark ? colors.gray[50] : colors.gray[900]
  const bodyColor = isDark ? colors.gray[400] : colors.gray[500]
  const primaryBg = isDark ? colors.primary.dark : colors.primary.light
  const secondaryBg = isDark ? colors.border.dark : colors.gray[100]
  const secondaryText = isDark ? colors.gray[50] : colors.gray[700]

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={handleSheetDismiss}
    >
      <View style={[s.content, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.body}>
          <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
            <CheckCircle2 size={32} color={successColor} />
          </View>

          <Text style={[s.title, { color: titleColor }]}>
            Đơn của bạn đã sẵn sàng!
          </Text>

          {!!pendingOrder?.referenceNumber && (
            <Text style={[s.orderInfo, { color: bodyColor }]}>
              Đơn #{pendingOrder.referenceNumber}
              {pendingOrder.branchName ? ` • ${pendingOrder.branchName}` : ''}
            </Text>
          )}

          <Text style={[s.hint, { color: bodyColor }]}>
            Vui lòng đến quầy để nhận đơn của bạn
          </Text>
        </View>

        <View style={s.footer}>
          <Pressable
            onPress={handleDismissLater}
            style={[s.btn, { backgroundColor: secondaryBg }]}
            accessibilityRole="button"
            accessibilityLabel="Ẩn thông báo"
          >
            <Text style={[s.btnText, { color: secondaryText }]}>Để sau</Text>
          </Pressable>

          <Pressable
            onPress={handleViewOrder}
            style={[s.btn, { backgroundColor: primaryBg }]}
            accessibilityRole="button"
            accessibilityLabel="Xem chi tiết đơn"
          >
            <Text style={[s.btnText, { color: colors.white.light }]}>
              Xem chi tiết đơn
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: 'BeVietnamPro_700Bold',
    textAlign: 'center',
  },
  orderInfo: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_600SemiBold',
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
})
