/**
 * OrderReadyPickupSheet — prominent bottom sheet notifying the customer that
 * their order is ready for pickup.
 *
 * Show conditions (all must be true):
 * - useOrderReadyQueue returns a non-null activeOrder
 * - Pathname is NOT /order/ (order-detail is already showing the order)
 *
 * Dismiss behaviors:
 * - "Xem chi tiết đơn" → markDone + navigate + suppressFor(600ms)
 * - Swipe / scrim      → markDone + toast (user can revisit via Notifications)
 *
 * Pending badge: if pendingCount > 1, shows "Còn N-1 đơn nữa đang chờ"
 * with a pulsing Reanimated dot between the handle and the icon.
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
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import {
  useOrderReadyQueue,
  type PendingOrder,
} from '@/hooks/use-order-ready-queue'
import { navigateNative, scheduleTransitionTask } from '@/lib/navigation'
import { showToastInternal } from '@/providers/toast-provider'

const SNAP_POINTS = ['45%']
// Pause before re-presenting the next order so the dismiss animation has
// visual breathing room. Only applied between consecutive orders, not on
// the initial present.
const NEXT_ORDER_DELAY_MS = 400

export const OrderReadyPickupSheet = memo(function OrderReadyPickupSheet() {
  const pathname = usePathname()
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

  const { activeOrder, pendingCount, markDone, suppressFor } =
    useOrderReadyQueue()

  const shouldSuppress = pathname?.startsWith('/order/')

  const sheetRef = useRef<BottomSheetModal>(null)
  const shownOrderRef = useRef<string | null>(null)
  const isProgrammaticRef = useRef(false)
  const activeOrderRef = useRef<PendingOrder | null>(null)
  const hasEverDismissedRef = useRef(false)
  const presentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    activeOrderRef.current = activeOrder
  }, [activeOrder])

  useEffect(() => {
    const shouldShow = !!activeOrder && !shouldSuppress

    if (shouldShow && shownOrderRef.current !== activeOrder.orderSlug) {
      const wasNotShowing = shownOrderRef.current === null
      shownOrderRef.current = activeOrder.orderSlug
      if (wasNotShowing) {
        if (presentTimerRef.current) clearTimeout(presentTimerRef.current)
        if (hasEverDismissedRef.current) {
          presentTimerRef.current = setTimeout(() => {
            presentTimerRef.current = null
            sheetRef.current?.present()
          }, NEXT_ORDER_DELAY_MS)
        } else {
          requestAnimationFrame(() => sheetRef.current?.present())
        }
      }
    } else if (!shouldShow && shownOrderRef.current !== null) {
      if (presentTimerRef.current) {
        clearTimeout(presentTimerRef.current)
        presentTimerRef.current = null
      }
      isProgrammaticRef.current = true
      sheetRef.current?.dismiss()
    }
  }, [activeOrder, shouldSuppress])

  useEffect(() => {
    return () => {
      if (presentTimerRef.current) clearTimeout(presentTimerRef.current)
    }
  }, [])

  const handleSheetDismiss = useCallback(() => {
    if (!isProgrammaticRef.current && activeOrderRef.current) {
      markDone(activeOrderRef.current.orderSlug)
      showToastInternal(
        'Thông báo đơn hàng',
        'Bạn có thể xem lại trong mục Thông báo',
        'info',
      )
    }
    isProgrammaticRef.current = false
    shownOrderRef.current = null
    hasEverDismissedRef.current = true
  }, [markDone])

  const handleViewOrder = useCallback(() => {
    if (!activeOrder) return
    suppressFor(600)
    isProgrammaticRef.current = true
    shownOrderRef.current = null
    sheetRef.current?.dismiss()
    navigateNative.push(`/order/${activeOrder.orderSlug}`)
    scheduleTransitionTask(() => {
      markDone(activeOrder.orderSlug)
    })
  }, [activeOrder, markDone, suppressFor])

  const dotOpacity = useSharedValue(1)
  useEffect(() => {
    if (pendingCount <= 1) {
      cancelAnimation(dotOpacity)
      dotOpacity.value = 1
      return
    }
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 750 }),
        withTiming(1, { duration: 750 }),
      ),
      -1,
    )
    return () => cancelAnimation(dotOpacity)
  }, [dotOpacity, pendingCount])
  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }))

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

  const theme = useMemo(
    () => ({
      successColor: isDark ? colors.success.dark : colors.success.light,
      iconBg: isDark ? colors.success.iconBgDark : colors.success.iconBgLight,
      titleColor: isDark ? colors.gray[50] : colors.gray[900],
      bodyColor: isDark ? colors.gray[400] : colors.gray[500],
      primaryBg: isDark ? colors.primary.dark : colors.primary.light,
      badgeBg: isDark ? 'rgba(232,184,75,0.12)' : 'rgba(232,184,75,0.10)',
      badgeBorder: 'rgba(232,184,75,0.35)',
      badgeText: isDark ? '#E8B84B' : '#966c00',
    }),
    [isDark],
  )

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
          {pendingCount > 1 && (
            <View
              style={[
                s.pendingBadge,
                {
                  backgroundColor: theme.badgeBg,
                  borderColor: theme.badgeBorder,
                },
              ]}
            >
              <Animated.View style={[s.pendingDot, animatedDotStyle]} />
              <Text style={[s.pendingText, { color: theme.badgeText }]}>
                Còn {pendingCount - 1} đơn nữa đang chờ
              </Text>
            </View>
          )}

          <View style={[s.iconWrap, { backgroundColor: theme.iconBg }]}>
            <CheckCircle2 size={32} color={theme.successColor} />
          </View>

          <Text style={[s.title, { color: theme.titleColor }]}>
            Đơn của bạn đã sẵn sàng!
          </Text>

          {!!activeOrder?.referenceNumber && (
            <Text style={[s.orderInfo, { color: theme.bodyColor }]}>
              Đơn #{activeOrder.referenceNumber}
              {activeOrder.branchName ? ` • ${activeOrder.branchName}` : ''}
            </Text>
          )}

          <Text style={[s.hint, { color: theme.bodyColor }]}>
            Vui lòng đến quầy để nhận đơn của bạn
          </Text>
        </View>

        <View style={s.footer}>
          <Pressable
            onPress={handleViewOrder}
            style={[s.btn, { backgroundColor: theme.primaryBg }]}
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
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8B84B',
  },
  pendingText: {
    fontSize: 12,
    fontFamily: 'BeVietnamPro_600SemiBold',
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
