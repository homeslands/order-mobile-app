import { ScreenContainer } from '@/components/layout'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { useFocusEffect } from '@react-navigation/native'
import { Image as ExpoImage } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { CircleAlert, CircleX, Ticket } from 'lucide-react-native'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native'
import Animated, { runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated'
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import PaymentMethodRadioGroup from '@/components/radio/payment-method-radio-group'
import { Skeleton } from '@/components/ui'
import { colors, NotificationMessageCode, PaymentMethod, TAB_ROUTES } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useInitiatePayment, useInitiatePublicPayment, useOrderBySlug, useRunAfterTransition, useUpdatePublicVoucherInOrder, useUpdateVoucherInOrder } from '@/hooks'
import { useAnimatedCountdown } from '@/hooks/use-animated-countdown'
import { useCoinBalance } from '@/hooks/use-coin-balance'
import { useLoyaltyPoints } from '@/hooks/use-loyalty-point'
import { navigateNative } from '@/lib/navigation'
import { useNotificationStore, useUserStore } from '@/stores'
import { OrderStatus } from '@/types'
import { calculateOrderDisplayAndTotals, formatCurrency, showErrorToast, showErrorToastMessage, showToast } from '@/utils'

import LoyaltyPointsInput from './loyalty-points-input'
import VoucherConflictBottomSheet from './voucher-conflict-bottom-sheet'
import { VoucherSheetInPayment } from './voucher-sheet-in-payment'
import { InvoiceSection } from './payment-invoice-section'
import { PaymentOrderInfoCard } from './payment-order-info-card'
import { PaymentProductItem } from './payment-product-item'
import { PaymentSummaryCard } from './payment-summary-card'
import { PointConfirmDialog } from './payment-point-confirm-dialog'

function PaymentSkeletonShell() {
  return (
    <ScreenContainer edges={['top']} style={{ flex: 1, backgroundColor: colors.background.light }}>
      <View style={skeletonStyles.header}>
        <Skeleton style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12 }} />
        <Skeleton style={{ height: 20, width: 192, borderRadius: 6 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={skeletonStyles.card}>
          <Skeleton style={{ height: 16, width: 128, borderRadius: 6 }} />
          <Skeleton style={{ height: 24, width: 160, borderRadius: 6 }} />
          <Skeleton style={{ height: 16, width: 112, borderRadius: 6 }} />
          <Skeleton style={{ height: 16, width: 96, borderRadius: 6 }} />
        </View>
        <View style={skeletonStyles.card}>
          <Skeleton style={{ height: 16, width: 160, borderRadius: 6 }} />
          <Skeleton style={{ height: 40, width: '100%', borderRadius: 8 }} />
          <Skeleton style={{ height: 40, width: '100%', borderRadius: 8 }} />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const skeletonStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.white.light, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray[200] },
  card: { marginBottom: 16, borderRadius: 12, backgroundColor: colors.white.light, borderWidth: 1, borderColor: colors.gray[100], padding: 16, gap: 12 },
})

// Module-scope: stable Set, shared across renders + all closures. No useMemo needed.
const PAID_NOTIFICATION_CODES: ReadonlySet<NotificationMessageCode> = new Set([
  NotificationMessageCode.ORDER_PAID,
  NotificationMessageCode.CARD_ORDER_PAID,
])

const pSectionStyles = StyleSheet.create({
  // card: { marginBottom: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  // cardHeaderText: { fontSize: 14, fontWeight: '500' },
  cardBody: { padding: 16 },
})

// ─── QRSection — memo-isolated so it doesn't re-render on isInitiating changes ─

const QRSection = React.memo(function QRSection({
  qrCode,
  paymentQrCode,
  subtotal,
  primaryColor,
  isDark,
}: {
  qrCode: string | null
  paymentQrCode: string | null | undefined
  subtotal: number
  primaryColor: string
  isDark: boolean
}) {
  const { t } = useTranslation('menu')
  return (
    <View style={[ps.qrSection, { borderTopColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
      <View style={ps.qrCenter}>
        <ExpoImage source={qrCode || paymentQrCode || ''} style={ps.qrImage} contentFit="contain" cachePolicy="none" />
        <View style={ps.qrInfoCol}>
          <View style={ps.qrTotalRow}>
            <Text style={[ps.smText, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>{t('paymentMethod.total', 'Tổng tiền')}:</Text>
            <Text style={[ps.lgBold, { color: primaryColor }]}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={ps.qrNoteRow}>
            <CircleAlert size={12} color="#3b82f6" />
            <Text style={[ps.xsText, { color: isDark ? colors.gray[400] : colors.gray[500], textAlign: 'center' }]}>{t('paymentMethod.paymentNote', 'Quét QR code để thanh toán')}</Text>
          </View>
        </View>
      </View>
    </View>
  )
})

// ─── PaymentMethodSection (isolates qrCode + isInitiatingPayment state) ────

const PaymentMethodSection = React.memo(function PaymentMethodSection({
  order,
  primaryColor,
  isDark,
  selectedMethod,
  onMethodChange,
  onConflict,
  isInitiating,
  qrCode,
  coinBalance,
}: {
  order: NonNullable<ReturnType<typeof useOrderBySlug>['data']>['result']
  primaryColor: string
  isDark: boolean
  selectedMethod: string | null
  onMethodChange: (method: PaymentMethod, transactionId?: string) => void
  onConflict: (blockedMethod: PaymentMethod) => void
  isInitiating: boolean
  qrCode: string | null
  coinBalance?: number
}) {
  const { t } = useTranslation('menu')

  if (!order || order.status !== OrderStatus.PENDING) return null

  return (
    <View style={[ps.card, { backgroundColor: isDark ? colors.gray[800] : colors.white.light, borderColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
      <View style={[pSectionStyles.cardHeader, { backgroundColor: isDark ? colors.gray[900] : colors.gray[50], borderBottomColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
        <Text style={[ps.semibold, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>{t('paymentMethod.title', 'Phương thức thanh toán')}</Text>
        <Text style={[ps.xsText, { color: isDark ? colors.gray[400] : colors.gray[500], marginTop: 4 }]}>({t('paymentMethod.cashMethodNote', 'Chọn phương thức thanh toán')})</Text>
      </View>
      <View style={pSectionStyles.cardBody}>
        <PaymentMethodRadioGroup
          order={order}
          value={selectedMethod}
          defaultValue={order.payment?.paymentMethod || null}
          disabledMethods={order.payment?.paymentMethod ? [order.payment.paymentMethod as PaymentMethod] : []}
          disabledReasons={order.payment?.paymentMethod ? { [order.payment.paymentMethod as PaymentMethod]: t('paymentMethod.alreadyPaid', 'Đã thanh toán') } as Record<PaymentMethod, string> : undefined}
          onSelect={onMethodChange}
          onConflict={onConflict}
          coinBalance={coinBalance}
        />
      </View>
      {isInitiating && (
        <View style={ps.processingRow}>
          <ActivityIndicator size="small" color={primaryColor} />
          <Text style={[ps.xsText, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>{t('paymentMethod.processing', 'Đang xử lý...')}</Text>
        </View>
      )}
      {(qrCode || order.payment?.qrCode) && order.payment?.paymentMethod === PaymentMethod.BANK_TRANSFER && (
        <QRSection
          qrCode={qrCode}
          paymentQrCode={order.payment?.qrCode}
          subtotal={order.subtotal || 0}
          primaryColor={primaryColor}
          isDark={isDark}
        />
      )}
    </View>
  )
})

// ─── Payment Success Screen ──────────────────────────────────────────────────

const PaymentSuccessScreen = React.memo(function PaymentSuccessScreen({
  orderSlug,
  primaryColor,
  isDark,
  onViewDetail,
}: {
  orderSlug: string
  primaryColor: string
  isDark: boolean
  onViewDetail: () => void
}) {
  const { t } = useTranslation('menu')
  const insets = useSafeAreaInsets()
  const screenBg = isDark ? colors.background.dark : colors.background.light

  const handleGoMenu = useCallback(() => {
    navigateNative.replace(TAB_ROUTES.MENU)
  }, [])

  return (
    <ScreenContainer edges={['top']} style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={[suc.container, { paddingBottom: insets.bottom + 24 }]}>
        <ExpoImage
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
          source={require('@/assets/images/food/order-success.png')}
          style={suc.image}
          contentFit="contain"
        />
        <Text style={[suc.title, { color: primaryColor }]}>
          {t('payment.successTitle', 'Thanh toán thành công!')}
        </Text>
        <Text style={[suc.subtitle, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
          {t('payment.successSubtitle', 'Đơn hàng #{{slug}} của bạn đã được thanh toán.', { slug: orderSlug })}
        </Text>

        <View style={suc.actions}>
          <Pressable
            onPress={onViewDetail}
            style={[suc.btnSecondary, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100], borderColor: isDark ? colors.gray[500] : colors.gray[300], flex: 1 }]}
          >
            <Text style={[suc.btnSecondaryText, { color: isDark ? colors.gray[200] : colors.gray[700] }]}>
              {t('payment.viewOrderDetail', 'Xem chi tiết đơn')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleGoMenu}
            style={[suc.btnPrimary, { backgroundColor: primaryColor, flex: 1 }]}
          >
            <Text style={suc.btnPrimaryText}>
              {t('payment.goToMenu', 'Xem thực đơn')}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  )
})

const suc = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  image: { width: 200, height: 200, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 16 },
  btnPrimary: { height: 50, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.white.light },
  btnSecondary: { height: 50, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
})

// ─── Payment Countdown Badge ─────────────────────────────────────────────────

const PAYMENT_TIMEOUT_SECONDS = 900 // 15 minutes, per payment-expiration-calculation doc

function computePaymentRemaining(startTime: string): number {
  const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
  return Math.max(0, PAYMENT_TIMEOUT_SECONDS - elapsed)
}

// Animated TextInput — lets Reanimated update text content on the UI thread (no re-renders)
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

function formatCountdown(sec: number): string {
  'worklet'
  if (sec <= 0) return 'Hết hạn'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

const PaymentCountdownBadge = memo(function PaymentCountdownBadge({
  startTime,
  onExpire,
}: {
  startTime: string
  onExpire?: () => void
}) {
  const isDark = useColorScheme() === 'dark'
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire })

  // Convert startTime → expiresAt for the hook
  const expiresAt = useMemo(() => {
    const d = new Date(startTime)
    d.setSeconds(d.getSeconds() + PAYMENT_TIMEOUT_SECONDS)
    return d.toISOString()
  }, [startTime])

  // SharedValue — updates on UI thread, zero re-renders
  const secondsShared = useAnimatedCountdown({ expiresAt })

  // Handle already-expired on mount
  useEffect(() => {
    if (computePaymentRemaining(startTime) <= 0) onExpireRef.current?.()
  }, [startTime])

  // Bridge expiry event from UI thread → JS (runOnJS only when countdown hits 0)
  const fireExpire = useCallback(() => { onExpireRef.current?.() }, [])
  useAnimatedReaction(
    () => secondsShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(fireExpire)()
      }
    },
  )

  // Background color — reactive on UI thread, no re-render needed
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: secondsShared.value <= 60
      ? isDark ? colors.destructive.dark : colors.destructive.light
      : colors.warning.light,
  }), [isDark])

  // Text — formatted on UI thread via animatedProps
  const textProps = useAnimatedProps(() => ({
    value: formatCountdown(secondsShared.value),
  }))

  return (
    <Animated.View style={[cds.pill, cds.shadow, pillStyle]}>
      <AnimatedTextInput
        animatedProps={textProps}
        editable={false}
        pointerEvents="none"
        style={cds.text}
      />
    </Animated.View>
  )
})

const cds = StyleSheet.create({
  pill: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white.light,
    letterSpacing: 0.5,
    textAlign: 'center',
    padding: 0,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
})

// ─── Bottom Action Bar (memo-isolated for style stability) ──────────────────

const BottomActionBar = React.memo(function BottomActionBar({
  insetBottom,
  isDark,
  isExpired,
  isInitiatingPayment,
  selectedPaymentMethod,
  primaryColor,
  onSubmit,
  children,
}: {
  insetBottom: number
  isDark: boolean
  isExpired: boolean
  isInitiatingPayment: boolean
  selectedPaymentMethod: PaymentMethod | null
  primaryColor: string
  onSubmit: () => void
  children?: React.ReactNode
}) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')

  const barStyle = useMemo(
    () => ({
      paddingBottom: insetBottom,
      backgroundColor: isDark ? colors.gray[800] : colors.white.light,
      borderTopColor: isDark ? colors.gray[700] : colors.gray[200],
    }),
    [insetBottom, isDark],
  )

  const btnStyle = useMemo(
    () => ({
      backgroundColor: isExpired
        ? (isDark ? colors.destructive.dark : colors.destructive.light)
        : selectedPaymentMethod
          ? primaryColor
          : (isDark ? colors.gray[600] : colors.gray[300]),
      opacity: isExpired ? 0.7 : 1,
    }),
    [isExpired, isDark, selectedPaymentMethod, primaryColor],
  )

  return (
    <View style={[ps.bottomBar, barStyle]}>
      <Pressable
        onPress={isExpired ? undefined : onSubmit}
        disabled={isExpired || !selectedPaymentMethod || isInitiatingPayment}
        style={[ps.checkoutBtn, btnStyle]}
      >
        {isInitiatingPayment
          ? <ActivityIndicator color={colors.white.light} />
          : <Text style={ps.checkoutBtnText}>
              {isExpired
                ? 'Hết hạn thanh toán'
                : selectedPaymentMethod
                  ? tCommon('common.checkout', 'Thanh toán')
                  : t('paymentMethod.noMethodSelected', 'Chưa chọn phương thức')}
            </Text>
        }
      </Pressable>
      {children}
    </View>
  )
})

// ─── Main Page ──────────────────────────────────────────────────────────────

function PaymentPageContent() {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { order: orderSlug, from } = useLocalSearchParams<{ order: string; from?: string }>()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const insets = useSafeAreaInsets()
  const { data: orderResponse, isPending, isError: isOrderError, refetch: refetchOrder } = useOrderBySlug(orderSlug)
  const order = orderResponse?.result
  const screenBg = isDark ? colors.background.dark : colors.background.light

  // Defer non-critical sections until after navigation transition
  const [transitionReady, setTransitionReady] = useState(false)
  useRunAfterTransition(() => setTransitionReady(true), [])

  // ─── Debug Logging ───
  // useEffect(() => {
  //   if (__DEV__) {
  //     console.log('[Payment Page] Loaded', {
  //       orderSlug,
  //       isLoggedIn: !!useUserStore.getState().userInfo,
  //       isPending,
  //       hasOrder: !!order,
  //       error: orderError ? {
  //         message: orderError instanceof Error ? orderError.message : String(orderError),
  //       } : null,
  //     })
  //   }
  // }, [orderSlug, isPending, order, orderError])

  // Show success screen when:
  // 1. Foreground FCM arrived → unread ORDER_PAID / CARD_ORDER_PAID notification in store, OR
  // 2. order.status already PAID (e.g. background FCM + refetch, or staff POS confirm)
  const hasOrderPaidNotification = useNotificationStore((s) =>
    s.notifications.some(
      (n) =>
        !n.isRead &&
        PAID_NOTIFICATION_CODES.has(n.message as NotificationMessageCode) &&
        n.metadata?.order === orderSlug,
    ),
  )
  const showSuccess = hasOrderPaidNotification || order?.status === OrderStatus.PAID
  const markNotificationRead = useNotificationStore((s) => s.markAsRead)

  const handleViewDetail = useCallback(() => {
    const paid = useNotificationStore
      .getState()
      .notifications.find(
        (n) =>
          PAID_NOTIFICATION_CODES.has(n.message as NotificationMessageCode) &&
          n.metadata?.order === orderSlug,
      )
    if (paid) markNotificationRead(paid.slug)
    navigateNative.replace(`/order/${orderSlug}` as Parameters<typeof navigateNative.replace>[0])
  }, [markNotificationRead, orderSlug])

  // Auto-refetch when FCM "order paid" notification arrives for this order
  const processedRef = useRef<Set<string>>(new Set())
  const latestNotification = useNotificationStore((s) => s.notifications[0])
  useEffect(() => {
    if (!latestNotification || latestNotification.isRead) return
    if (processedRef.current.has(latestNotification.slug)) return
    if (
      PAID_NOTIFICATION_CODES.has(latestNotification.message as NotificationMessageCode) &&
      latestNotification.metadata?.order === orderSlug
    ) {
      processedRef.current.add(latestNotification.slug)
      refetchOrder()
    }
  }, [latestNotification, orderSlug, refetchOrder])

  const orderItems = useMemo(() => order?.orderItems || [], [order?.orderItems])
  const voucher = useMemo(() => order?.voucher ?? null, [order?.voucher])

  const { displayItemMap, cartTotals } = useMemo(() => {
    const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(orderItems, voucher)
    const map = new Map<string, (typeof displayItems)[number]>()
    for (const di of displayItems) map.set(di.slug, di)
    return { displayItemMap: map, cartTotals }
  }, [orderItems, voucher])

  const handleBack = useCallback(() => {
    if (from === 'history') {
      navigateNative.back()
    } else {
      navigateNative.replace(TAB_ROUTES.HOME)
    }
  }, [from])

  const [isExpired, setIsExpired] = useState(false)
  const handleExpire = useCallback(() => {
    setIsExpired(true)
    void refetchOrder()
  }, [refetchOrder])

  // Memoize so FloatingHeader (memo'd) doesn't re-render on every parent render.
  // Narrow deps: only the fields actually read — react-query returns new order ref
  // on every refetch (e.g. polling), which would otherwise bust this memo constantly.
  const orderStatus = order?.status
  const countdownStartTime = order?.payment?.createdAt ?? order?.createdAt ?? ''
  const countdownRight = useMemo(() => {
    if (orderStatus !== OrderStatus.PENDING) return undefined
    return <PaymentCountdownBadge startTime={countdownStartTime} onExpire={handleExpire} />
  }, [orderStatus, countdownStartTime, handleExpire])

  // Refetch when screen regains focus — catches background FCM that didn't go through store
  useFocusEffect(
    useCallback(() => {
      void refetchOrder()
    }, [refetchOrder]),
  )

  // Clear image memory cache on blur (QR code + product images)
  useFocusEffect(
    useCallback(() => {
      return () => {
        queueMicrotask(() => ExpoImage.clearMemoryCache())
      }
    }, []),
  )

  // ── Payment method selection + submission ──
  const userInfo = useUserStore((s) => s.userInfo)
  const isLoggedIn = !!userInfo

  // Coin balance — chỉ fetch khi logged in + order PENDING
  const { balance: coinBalance, refetch: refetchCoinBalance } =
    useCoinBalance(isLoggedIn)

  // Loyalty points — chỉ fetch khi logged in + order PENDING
  const loyaltyData = useLoyaltyPoints(
    order?.status === OrderStatus.PENDING && isLoggedIn ? (userInfo?.slug ?? undefined) : undefined,
  )
  const userTotalPoints = loyaltyData.data?.totalPoints ?? 0
  const refetchLoyalty = loyaltyData.refetch

  // Refetch coin balance + loyalty points on screen focus to get fresh data
  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        void refetchCoinBalance()
        void refetchLoyalty()
      }
    }, [isLoggedIn, refetchCoinBalance, refetchLoyalty]),
  )

  const { mutate: initiatePaymentAuth, isPending: isInitiatingPaymentAuth } = useInitiatePayment()
  const { mutate: initiatePaymentPublic, isPending: isInitiatingPaymentPublic } = useInitiatePublicPayment()
  const initiatePayment = isLoggedIn ? initiatePaymentAuth : initiatePaymentPublic
  const isInitiatingPayment = isLoggedIn ? isInitiatingPaymentAuth : isInitiatingPaymentPublic

  const [paymentForm, dispatchPaymentForm] = React.useReducer(
    (
      state: { method: PaymentMethod | null; transactionId: string; qrCode: string | null },
      action:
        | { type: 'SET_METHOD'; method: PaymentMethod; transactionId?: string }
        | { type: 'SET_QR'; qrCode: string }
        | { type: 'SET_TRANSACTION_ID'; transactionId: string },
    ) => {
      switch (action.type) {
        case 'SET_METHOD':
          return {
            ...state,
            method: action.method,
            transactionId: action.transactionId ?? state.transactionId,
          }
        case 'SET_QR':
          return { ...state, qrCode: action.qrCode }
        case 'SET_TRANSACTION_ID':
          return { ...state, transactionId: action.transactionId }
      }
    },
    { method: null, transactionId: '', qrCode: null },
  )
  const selectedPaymentMethod = paymentForm.method
  const selectedTransactionId = paymentForm.transactionId
  const qrCode = paymentForm.qrCode

  // Fallback polling when QR is visible — covers FCM delivery failures.
  // Keep refetchOrder in a ref: react-query returns a new function ref per render,
  // which would otherwise tear down + recreate the interval on every voucher/state
  // tick (3-4 teardowns in the first second).
  const refetchOrderRef = React.useRef(refetchOrder)
  useEffect(() => {
    refetchOrderRef.current = refetchOrder
  }, [refetchOrder])

  useEffect(() => {
    if (!qrCode || showSuccess) return
    const id = setInterval(() => void refetchOrderRef.current(), 10_000)
    return () => clearInterval(id)
  }, [qrCode, showSuccess])

  const handleMethodChange = useCallback((method: PaymentMethod, transactionId?: string) => {
    dispatchPaymentForm({ type: 'SET_METHOD', method, transactionId })
  }, [])

  // ── Voucher ↔ Payment Method conflict (Feature 2) ───────────────────────────
  const { mutate: updateVoucherAuth } = useUpdateVoucherInOrder()
  const { mutate: updateVoucherPublic } = useUpdatePublicVoucherInOrder()

  const [showVoucherSheet, setShowVoucherSheet] = useState(false)

  const handleVoucherApplied = useCallback(() => {
    setShowVoucherSheet(false)
    void refetchOrder()
  }, [refetchOrder])

  const handleVoucherRemoved = useCallback(() => {
    setShowVoucherSheet(false)
    void refetchOrder()
  }, [refetchOrder])

  const [conflictPendingMethod, setConflictPendingMethod] = useState<PaymentMethod | null>(null)
  const [showConflictSheet, setShowConflictSheet] = useState(false)
  const [isRemovingVoucher, setIsRemovingVoucher] = useState(false)

  const handlePaymentMethodConflict = useCallback((blockedMethod: PaymentMethod) => {
    setConflictPendingMethod(blockedMethod)
    setShowConflictSheet(true)
  }, [])

  const handleKeepVoucher = useCallback(() => {
    setShowConflictSheet(false)
    setConflictPendingMethod(null)
  }, [])

  const handleRemoveVoucherForConflict = useCallback(() => {
    if (!orderSlug || !order || isRemovingVoucher) return
    setIsRemovingVoucher(true)

    const orderItemsParam = order.orderItems.map((item) => ({
      quantity: item.quantity,
      variant: item.variant?.slug ?? '',
      promotion: item.promotion?.slug ?? '',
      order: orderSlug,
    }))

    const updateVoucher = isLoggedIn ? updateVoucherAuth : updateVoucherPublic
    updateVoucher(
      { slug: orderSlug, voucher: null, orderItems: orderItemsParam },
      {
        onSuccess: () => {
          setIsRemovingVoucher(false)
          setShowConflictSheet(false)
          if (conflictPendingMethod) handleMethodChange(conflictPendingMethod)
          setConflictPendingMethod(null)
          void refetchOrder()
        },
        onError: () => {
          setIsRemovingVoucher(false)
          showErrorToastMessage('Không thể xóa voucher')
        },
      },
    )
  }, [orderSlug, order, isLoggedIn, isRemovingVoucher, conflictPendingMethod, updateVoucherAuth, updateVoucherPublic, handleMethodChange, refetchOrder])

  // ── Point payment confirm dialog ──
  const [showPointConfirm, setShowPointConfirm] = useState(false)
  const closePointConfirm = useCallback(() => setShowPointConfirm(false), [])

  const executePayment = useCallback(() => {
    if (!selectedPaymentMethod || !orderSlug || !order) return

    const payload: { paymentMethod: string; orderSlug: string; transactionId?: string } = {
      paymentMethod: selectedPaymentMethod,
      orderSlug,
    }
    if (selectedTransactionId.trim()) payload.transactionId = selectedTransactionId.trim()

    initiatePayment(payload, {
      onSuccess: (response) => {
        if (response?.result?.qrCode) dispatchPaymentForm({ type: 'SET_QR', qrCode: response.result.qrCode })
        void refetchOrder()
        if (selectedPaymentMethod === PaymentMethod.POINT) {
          showToast(t('paymentMethod.coinPaymentSubmitted', 'Đã thanh toán bằng xu thành công'))
          void refetchCoinBalance()
        }
      },
      onError: (error: unknown) => {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { data?: { statusCode?: number; message?: string } } }
          if (axiosError.response?.data?.statusCode) { showErrorToast(axiosError.response.data.statusCode); return }
          if (axiosError.response?.data?.message) {
            if (axiosError.response.data.message?.toLowerCase().includes('insufficient balance')) {
              showErrorToastMessage(t('toast:toast.insufficientBalance', 'Bạn không đủ số dư để thanh toán đơn hàng'))
              return
            }
            showErrorToastMessage(axiosError.response.data.message)
            return
          }
        }
        showToast(t('paymentMethod.paymentError', 'Lỗi khi cập nhật phương thức thanh toán'))
      },
    })
  }, [selectedPaymentMethod, selectedTransactionId, orderSlug, order, initiatePayment, refetchOrder, refetchCoinBalance, t])

  const handlePaymentSubmit = useCallback(() => {
    if (!selectedPaymentMethod || !orderSlug || !order) return
    if (order.payment?.paymentMethod && order.payment.statusMessage === OrderStatus.COMPLETED) return
    if (selectedPaymentMethod === PaymentMethod.CREDIT_CARD && !selectedTransactionId.trim()) return

    // Show confirm dialog for point payment
    if (selectedPaymentMethod === PaymentMethod.POINT) {
      setShowPointConfirm(true)
      return
    }

    executePayment()
  }, [selectedPaymentMethod, selectedTransactionId, orderSlug, order, executePayment])

  const handleConfirmPointPayment = useCallback(() => {
    setShowPointConfirm(false)
    executePayment()
  }, [executePayment])

  if (isPending) {
    return <PaymentSkeletonShell />
  }

  if (showSuccess) {
    return (
      <PaymentSuccessScreen
        orderSlug={orderSlug ?? ''}
        primaryColor={primaryColor}
        isDark={isDark}
        onViewDetail={handleViewDetail}
      />
    )
  }

  if (isOrderError) {
    return (
      <ScreenContainer edges={['top']} style={[{ flex: 1, backgroundColor: screenBg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <CircleX size={64} color={isDark ? colors.gray[400] : colors.gray[500]} />
          <Text style={{ marginTop: 16, textAlign: 'center', color: isDark ? colors.gray[400] : colors.gray[600] }}>
            {t('payment.loadFailed', 'Không thể tải đơn hàng. Vui lòng thử lại.')}
          </Text>
          <Pressable onPress={() => void refetchOrder()} style={[ps.checkoutBtn, { backgroundColor: primaryColor, marginTop: 16, paddingHorizontal: 24 }]}>
            <Text style={ps.checkoutBtnText}>{tCommon('common.retry', 'Thử lại')}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    )
  }

  if (!order) {
    return (
      <ScreenContainer edges={['top']} style={[{ flex: 1, backgroundColor: screenBg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <CircleX size={64} color={isDark ? colors.gray[400] : colors.gray[500]} />
          <Text style={{ marginTop: 16, textAlign: 'center', color: isDark ? colors.gray[400] : colors.gray[600] }}>
            {t('menu.noData', 'Không có dữ liệu')}
          </Text>
          <Pressable onPress={handleBack} style={[ps.checkoutBtn, { backgroundColor: primaryColor, marginTop: 16, paddingHorizontal: 24 }]}>
            <Text style={ps.checkoutBtnText}>{tCommon('common.goBack', 'Quay lại')}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ScreenContainer edges={['top']} style={{ flex: 1 }}>
        {/* Content — GestureScrollView tránh conflict với Stack swipe-back */}
        <GestureScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: STATIC_TOP_INSET + 60, paddingBottom: 100 }}
          showsVerticalScrollIndicator={true}
        >
        <View style={ps.contentPad}>
          {/* Banner hết hạn */}
          {isExpired && (
            <View style={[ps.expiredBanner, { backgroundColor: isDark ? `${colors.destructive.dark}18` : `${colors.destructive.light}12`, borderColor: isDark ? colors.destructive.dark : colors.destructive.light }]}>
              <Text style={[ps.expiredBannerTitle, { color: isDark ? colors.destructive.dark : colors.destructive.light }]}>
                Đơn hàng đã hết hạn thanh toán
              </Text>
              <Text style={[ps.expiredBannerSub, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
                Thời gian thanh toán 15 phút đã hết. Vui lòng tạo đơn mới.
              </Text>
            </View>
          )}

          {/* Order Info — extracted to dedicated memoized component */}
          <PaymentOrderInfoCard order={order} isDark={isDark} />

          {/* Order Items List — no section header, clean */}
          <View style={[ps.card, { backgroundColor: isDark ? colors.gray[800] : colors.white.light, borderColor: isDark ? colors.gray[700] : colors.gray[100], padding: 16 }]}>
              {orderItems.map((item, index) => (
                <PaymentProductItem
                  key={item.slug || index}
                  item={item}
                  displayItem={displayItemMap.get(item.slug) ?? null}
                  voucher={voucher}
                  primaryColor={primaryColor}
                  isDark={isDark}
                  isLast={index === orderItems.length - 1}
                  noNoteLabel={t('order.noNote', 'Không có ghi chú')}
                />
              ))}
          </View>

          {/* Payment Method Selection — isolated component */}
          <PaymentMethodSection
            order={order}
            primaryColor={primaryColor}
            isDark={isDark}
            selectedMethod={selectedPaymentMethod}
            onMethodChange={handleMethodChange}
            onConflict={handlePaymentMethodConflict}
            isInitiating={isInitiatingPayment}
            qrCode={qrCode}
            coinBalance={coinBalance}
          />

          {/* Voucher Row */}
          {order.status === OrderStatus.PENDING && (
            <Pressable
              onPress={() => setShowVoucherSheet(true)}
              style={[ps.card, ps.voucherTrigger, { backgroundColor: isDark ? colors.gray[800] : colors.white.light, borderColor: isDark ? colors.gray[700] : colors.gray[100] }]}
            >
              <Ticket size={14} color={isDark ? colors.gray[400] : colors.gray[500]} />
              <Text style={[ps.voucherLabel, { flex: 1, color: isDark ? colors.gray[400] : colors.gray[500] }]}>
                Mã giảm giá
              </Text>
              {order.voucher && (
                <View style={ps.voucherRight}>
                  {(cartTotals?.voucherDiscount ?? 0) > 0 && (
                    <View style={[ps.discountBadge, { borderColor: primaryColor }]}>
                      <Text style={[ps.discountBadgeText, { color: primaryColor }]}>
                        -{formatCurrency(cartTotals?.voucherDiscount ?? 0)}
                      </Text>
                    </View>
                  )}
                  <Text style={[ps.voucherName, { color: primaryColor }]} numberOfLines={1}>
                    {order.voucher.title || order.voucher.code}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Loyalty Points Input — deferred until after navigation transition */}
          {transitionReady && isLoggedIn && order.status === OrderStatus.PENDING && (
            <LoyaltyPointsInput
              orderSlug={orderSlug ?? ''}
              orderTotal={(order.subtotal ?? 0) + (order.accumulatedPointsToUse ?? 0)}
              userTotalPoints={userTotalPoints}
              currentPointsUsed={order.accumulatedPointsToUse ?? 0}
              isDark={isDark}
              primaryColor={primaryColor}
              onApplied={refetchOrder}
              onCancelled={refetchOrder}
            />
          )}

          {/* Payment Summary — extracted to dedicated memoized component */}
          <PaymentSummaryCard
            order={order}
            cartTotals={cartTotals}
            coinBalance={coinBalance}
            primaryColor={primaryColor}
            isDark={isDark}
          />

          {/* Invoice — deferred until after navigation transition */}
          {transitionReady && <InvoiceSection order={order} primaryColor={primaryColor} isDark={isDark} />}
        </View>
        </GestureScrollView>

        {/* Bottom Action Bar */}
        {order.status === OrderStatus.PENDING && (
          <BottomActionBar
            insetBottom={insets.bottom}
            isDark={isDark}
            isExpired={isExpired}
            isInitiatingPayment={isInitiatingPayment}
            selectedPaymentMethod={selectedPaymentMethod}
            primaryColor={primaryColor}
            onSubmit={handlePaymentSubmit}
          >
          </BottomActionBar>
        )}
        <FloatingHeader
          title={t('order.payment', 'Thanh toán')}
          onBack={handleBack}
          rightElement={countdownRight}
        
          disableBlur
        />
        {showVoucherSheet && (
          <VoucherSheetInPayment
            visible={showVoucherSheet}
            onClose={() => setShowVoucherSheet(false)}
            isDark={isDark}
            primaryColor={primaryColor}
            order={order}
            currentPaymentMethod={selectedPaymentMethod}
            onVoucherApplied={handleVoucherApplied}
            onVoucherRemoved={handleVoucherRemoved}
          />
        )}
        {showConflictSheet && (
          <VoucherConflictBottomSheet
            visible={showConflictSheet}
            voucherCode={order.voucher?.code ?? ''}
            paymentMethodLabel={getPaymentMethodLabel(conflictPendingMethod)}
            isDark={isDark}
            primaryColor={primaryColor}
            isRemoving={isRemovingVoucher}
            onKeepVoucher={handleKeepVoucher}
            onRemoveVoucher={handleRemoveVoucherForConflict}
          />
        )}
        <PointConfirmDialog
          visible={showPointConfirm}
          onClose={closePointConfirm}
          onConfirm={handleConfirmPointPayment}
          orderSubtotal={order.subtotal || 0}
          coinBalance={coinBalance}
          primaryColor={primaryColor}
          isDark={isDark}
        />
      </ScreenContainer>
    </View>
  )
}

function getPaymentMethodLabel(method: PaymentMethod | null): string {
  if (!method) return ''
  const labels: Record<PaymentMethod, string> = {
    [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản',
    [PaymentMethod.CASH]: 'Tiền mặt',
    [PaymentMethod.POINT]: 'Điểm tích lũy',
    [PaymentMethod.CREDIT_CARD]: 'Thẻ tín dụng',
  }
  return labels[method] ?? method
}

const ps = StyleSheet.create({
  contentPad: { paddingHorizontal: 16, paddingVertical: 16 },
  card: { marginBottom: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  semibold: { fontSize: 16, fontWeight: '600' },
  smText: { fontSize: 14 },
  xsText: { fontSize: 12 },
  lgBold: { fontSize: 18, fontWeight: '700' },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  qrSection: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  qrCenter: { alignItems: 'center' },
  qrImage: { width: '40%', aspectRatio: 1 },
  qrInfoCol: { gap: 8, alignItems: 'center', marginTop: 8 },
  qrTotalRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qrNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16 },
  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 16 },
  checkoutBtn: { height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  checkoutBtnText: { fontSize: 15, fontWeight: '700', color: colors.white.light },
  expiredBanner: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4, marginBottom: 12 },
  expiredBannerTitle: { fontSize: 14, fontWeight: '700' },
  expiredBannerSub: { fontSize: 12, lineHeight: 18 },
  voucherTrigger: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16 },
  voucherLabel: { fontSize: 13, fontWeight: '600' },
  voucherRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voucherName: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
  discountBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  discountBadgeText: { fontSize: 11, fontWeight: '700' },
})

export default function PaymentPage() {
  const [ready, setReady] = useState(false)
  useRunAfterTransition(() => setReady(true), [])
  if (!ready) return <PaymentSkeletonShell />
  return <PaymentPageContent />
}
