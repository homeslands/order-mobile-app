/**
 * Gift Card Payment Screen — khởi tạo thanh toán + hiển thị QR + FCM-based completion.
 *
 * Perf patterns:
 * - useGiftCardOrderPayment: FCM refetch + useFocusEffect — không dùng setInterval polling
 * - QRSection memo-isolated — không re-render khi isInitiating thay đổi
 * - useAnimatedCountdown chạy trên UI thread — zero JS re-renders per tick
 * - Clear QR memory cache khi blur
 */
import { Image as ExpoImage } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import {
  CheckCircle2,
  CircleX,
  Smartphone,
  Timer,
} from 'lucide-react-native'
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { FloatingHeader } from '@/components/navigation/floating-header'
import { Skeleton } from '@/components/ui'
import {
  CardOrderPaymentMethod,
  CardOrderStatus,
  colors,
} from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useInitiateCardOrderPayment } from '@/hooks/use-card-order'
import { useGiftCardOrderPayment } from '@/hooks/use-gift-card-order-payment'
import { useAnimatedCountdown } from '@/hooks/use-animated-countdown'
import { PAID_NOTIFICATION_CODES } from '@/hooks'
import { useCancelCardOrder } from '@/hooks/use-card-order'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useGiftCardStore, useNotificationStore } from '@/stores'
import { navigateNative, scheduleTransitionTask } from '@/lib/navigation'
import { formatCurrency, formatPoints, showErrorToastMessage } from '@/utils'

// Payment QR expires 15 minutes after initiation
const QR_EXPIRY_SECONDS = 900

function calcExpiryFromCreatedAt(createdAt?: string): string | undefined {
  if (!createdAt) return undefined
  return new Date(new Date(createdAt).getTime() + QR_EXPIRY_SECONDS * 1000).toISOString()
}

// Animated TextInput — lets Reanimated update text content on the UI thread (no re-renders)
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

function formatCountdownUI(sec: number): string {
  'worklet'
  if (sec <= 0) return 'Hết hạn'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

// ─── Payment Countdown Badge ──────────────────────────────────────────────────

const PaymentCountdownBadge = memo(function PaymentCountdownBadge({
  secondsShared,
  onExpire,
}: {
  secondsShared: SharedValue<number>
  onExpire?: () => void
}) {
  const isDark = useColorScheme() === 'dark'
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire })

  const fireExpire = useCallback(() => { onExpireRef.current?.() }, [])
  useAnimatedReaction(
    () => secondsShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(fireExpire)()
      }
    },
  )

  // Background color + opacity reactive on UI thread.
  // opacity: 0 when value === 0 prevents "Hết hạn" flash before effect initializes.
  // warning → destructive in last 60s
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: secondsShared.value <= 60
      ? isDark ? colors.destructive.dark : colors.destructive.light
      : colors.warning.light,
    opacity: secondsShared.value > 0 ? 1 : 0,
  }), [isDark])

  // Text formatted on UI thread via animatedProps
  const textProps = useAnimatedProps(() => ({
    value: secondsShared.value > 0 ? formatCountdownUI(secondsShared.value) : '',
  }))

  return (
    <Animated.View style={[bds.pill, bds.shadow, pillStyle]}>
      <AnimatedTextInput
        animatedProps={textProps}
        editable={false}
        pointerEvents="none"
        style={bds.text}
      />
    </Animated.View>
  )
})

const bds = StyleSheet.create({
  pill: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white.light,
    letterSpacing: 0.5,
    textAlign: 'center',
    padding: 0,
    minWidth: 44,
  },
})

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PaymentSkeleton() {
  return (
    <View style={sk.wrapper}>
      <View style={sk.card}>
        <Skeleton style={sk.line} />
        <Skeleton style={[sk.line, { width: '60%' }]} />
        <Skeleton style={[sk.line, { width: '40%' }]} />
      </View>
      <View style={sk.card}>
        <Skeleton style={[sk.line, { width: '50%' }]} />
        <Skeleton style={{ height: 200, borderRadius: 12 }} />
      </View>
    </View>
  )
}

const sk = StyleSheet.create({
  wrapper: { padding: 16, gap: 12, marginTop: 8 },
  card: {
    backgroundColor: colors.white.light,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  line: { height: 16, borderRadius: 6 },
})

// ─── QR Section — memo-isolated ───────────────────────────────────────────────

const QRSection = memo(function QRSection({
  qrCode,
  totalAmount,
  primaryColor,
  isDark,
  secondsShared,
  isExpired,
}: {
  qrCode: string
  totalAmount: number
  primaryColor: string
  isDark: boolean
  secondsShared: SharedValue<number>
  isExpired: boolean
}) {
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  // Countdown row hides on UI thread when expired or at 0
  const countdownRowStyle = useAnimatedStyle(() => ({
    display: secondsShared.value > 0 && !isExpired ? 'flex' : 'none',
  }))

  const countdownTextProps = useAnimatedProps(() => ({
    value: `Hết hạn sau ${formatCountdownUI(secondsShared.value)}`,
  }))

  return (
    <View style={[qs.container, { borderColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
      <View style={qs.qrWrap}>
        {isExpired ? (
          <View style={qs.expiredOverlay}>
            <Timer size={32} color={colors.gray[400]} />
            <Text style={[qs.expiredText, { color: subColor }]}>QR đã hết hạn</Text>
          </View>
        ) : (
          <ExpoImage
            source={qrCode}
            contentFit="contain"
            cachePolicy="none"
            style={qs.qrImage}
          />
        )}
      </View>

      <View style={qs.infoRow}>
        <Text style={[qs.totalLabel, { color: subColor }]}>Số tiền thanh toán</Text>
        <Text style={[qs.totalAmount, { color: primaryColor }]}>
          {formatCurrency(totalAmount)}
        </Text>
      </View>

      <Animated.View style={[qs.countdownRow, { backgroundColor: `${primaryColor}15` }, countdownRowStyle]}>
        <Timer size={14} color={primaryColor} />
        <AnimatedTextInput
          animatedProps={countdownTextProps}
          editable={false}
          pointerEvents="none"
          style={[qs.countdownText, { color: primaryColor }]}
        />
      </Animated.View>

      <View style={qs.noteRow}>
        <Text style={[qs.note, { color: subColor }]}>
          Quét mã QR bằng ứng dụng ngân hàng để hoàn tất thanh toán
        </Text>
      </View>
    </View>
  )
})

const qs = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  qrWrap: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.white.light,
  },
  qrImage: { width: '100%', height: '100%' },
  expiredOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gray[100],
  },
  expiredText: { fontSize: 14, fontWeight: '600' },
  infoRow: { alignItems: 'center', gap: 2 },
  totalLabel: { fontSize: 13 },
  totalAmount: { fontSize: 20, fontWeight: '800' },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  noteRow: { paddingHorizontal: 8 },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GiftCardPaymentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { bottom } = useSafeAreaInsets()

  const clearGiftCard = useGiftCardStore((s) => s.clearGiftCard)
  const { order, isPending, refetch } = useGiftCardOrderPayment(slug)
  const { mutate: initiatePayment, isPending: isInitiating } = useInitiateCardOrderPayment()
  const { mutate: cancelOrder } = useCancelCardOrder()

  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const hasNavigatedRef = useRef(false)

  // Expiry — counted from orderDate (set at order creation, before QR initiation)
  const expiryTime = useMemo(
    () => calcExpiryFromCreatedAt(order?.orderDate),
    [order?.orderDate],
  )

  // FCM-based success detection — immediate, no refetch wait
  // Mirrors usePaymentStatusDetector pattern from food/drink payment
  const fcmPaid = useNotificationStore((s) =>
    s.notifications.some(
      (n) =>
        !n.isRead &&
        PAID_NOTIFICATION_CODES.has(n.message) &&
        n.metadata?.order === slug,
    ),
  )
  const showSuccess = fcmPaid || order?.paymentStatus === CardOrderStatus.COMPLETED

  // UI-thread countdown — starts as soon as order loads, not waiting for QR
  const activeQR = qrCode ?? order?.payment?.qrCode ?? null
  const secondsShared = useAnimatedCountdown({
    expiresAt: expiryTime,
    enabled: !!order && !isExpired,
  })

  const handleExpire = useCallback(() => {
    setIsExpired(true)
    if (slug) {
      cancelOrder(slug, { onSettled: () => void refetch() })
    }
  }, [slug, cancelOrder, refetch])

  // Bridge expiry from UI thread → JS (fires regardless of QR state)
  useAnimatedReaction(
    () => secondsShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(handleExpire)()
      }
    },
  )

  // Navigate to success when paid — fires on FCM (immediate) or polling confirm
  useEffect(() => {
    if (!hasNavigatedRef.current && showSuccess && slug) {
      hasNavigatedRef.current = true
      navigateNative.replace(
        `/gift-card/order-success/${slug}` as Parameters<typeof navigateNative.replace>[0],
      )
      scheduleTransitionTask(() => clearGiftCard(false))
    }
  }, [showSuccess, slug, clearGiftCard])

  // Clear QR image memory on blur
  useFocusEffect(
    useCallback(() => {
      return () => {
        queueMicrotask(() => ExpoImage.clearMemoryCache())
      }
    }, []),
  )

  const isCancelled = order?.paymentStatus === CardOrderStatus.CANCELLED

  // Memoize badge so FloatingHeader (memo'd) doesn't re-render per parent render.
  // Show as soon as order loads — countdown starts from orderDate, not QR initiation.
  // secondsShared is a stable SharedValue ref — safe as memo dep.
  const countdownRight = useMemo(() => {
    if (!order || isExpired || isCancelled || showSuccess) return undefined
    return (
      <PaymentCountdownBadge
        secondsShared={secondsShared}
        onExpire={handleExpire}
      />
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, isExpired, isCancelled, showSuccess])

  const handleInitiatePayment = useCallback(() => {
    if (!slug) return
    initiatePayment(
      {
        cardorderSlug: slug,
        paymentMethod: CardOrderPaymentMethod.BANK_TRANSFER,
      },
      {
        onSuccess: (res) => {
          const code = res.result?.payment?.qrCode
          if (code) setQrCode(code)
          void refetch()
        },
        onError: () => {
          showErrorToastMessage('Không thể khởi tạo thanh toán. Vui lòng thử lại.')
        },
      },
    )
  }, [slug, initiatePayment, refetch])

  // Colors
  const bg = isDark ? colors.background.dark : colors.background.light
  const cardBg = isDark ? colors.gray[900] : colors.white.light
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  const totalAmount = (order?.cardPrice ?? 0) * (order?.quantity ?? 0)
  const alreadyHasQR = !!order?.payment?.qrCode

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <FloatingHeader
        title="Thanh toán"
        disableBlur
        rightElement={countdownRight}
      />

      {isPending ? (
        <View style={{ marginTop: STATIC_TOP_INSET + 56 }}>
          <PaymentSkeleton />
        </View>
      ) : !order ? (
        <View style={[s.empty, { marginTop: STATIC_TOP_INSET + 56 }]}>
          <CircleX size={48} color={colors.gray[400]} />
          <Text style={[s.emptyText, { color: subColor }]}>Không tìm thấy đơn hàng</Text>
        </View>
      ) : showSuccess ? (
        // Briefly shown while navigate fires
        <View style={[s.empty, { marginTop: STATIC_TOP_INSET + 56 }]}>
          <CheckCircle2 size={48} color={colors.success?.light ?? primaryColor} />
          <Text style={[s.emptyText, { color: textColor }]}>Thanh toán thành công!</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[
              s.scrollContent,
              { paddingTop: STATIC_TOP_INSET + 64, paddingBottom: bottom + 120 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Order info */}
            <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[s.cardTitle, { color: textColor }]}>Chi tiết đơn hàng</Text>
              <View style={s.infoRows}>
                <View style={s.infoRow}>
                  <Text style={[s.infoKey, { color: subColor }]}>Thẻ quà tặng</Text>
                  <Text style={[s.infoVal, { color: textColor }]} numberOfLines={1}>
                    {order.cardTitle}
                  </Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={[s.infoKey, { color: subColor }]}>Điểm / thẻ</Text>
                  <Text style={[s.infoVal, { color: primaryColor }]}>
                    +{formatPoints(order.cardPoint ?? 0)} điểm
                  </Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={[s.infoKey, { color: subColor }]}>Số lượng</Text>
                  <Text style={[s.infoVal, { color: textColor }]}>{order.quantity} thẻ</Text>
                </View>
                <View style={[s.divider, { backgroundColor: borderColor }]} />
                <View style={s.infoRow}>
                  <Text style={[s.infoKey, { color: subColor, fontWeight: '600' }]}>Tổng tiền</Text>
                  <Text style={[s.infoVal, { color: textColor, fontWeight: '800', fontSize: 16 }]}>
                    {formatCurrency(totalAmount || order.totalAmount)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment method */}
            {!isCancelled && !alreadyHasQR && !qrCode && (
              <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[s.cardTitle, { color: textColor }]}>Phương thức thanh toán</Text>
                <View style={[s.methodRow, { borderColor }]}>
                  <View style={[s.methodIcon, { backgroundColor: `${primaryColor}18` }]}>
                    <Smartphone size={20} color={primaryColor} />
                  </View>
                  <View style={s.methodInfo}>
                    <Text style={[s.methodLabel, { color: textColor }]}>Chuyển khoản ngân hàng</Text>
                    <Text style={[s.methodDesc, { color: subColor }]}>
                      Quét mã QR để thanh toán
                    </Text>
                  </View>
                  <View style={[s.methodRadio, { borderColor: primaryColor }]}>
                    <View style={[s.methodRadioDot, { backgroundColor: primaryColor }]} />
                  </View>
                </View>
              </View>
            )}

            {/* Cancelled state */}
            {isCancelled && (
              <View style={[s.card, s.cancelledCard, { backgroundColor: cardBg, borderColor: colors.destructive.light }]}>
                <CircleX size={24} color={colors.destructive.light} />
                <Text style={[s.cancelledText, { color: colors.destructive.light }]}>
                  Đơn hàng đã bị huỷ hoặc hết hạn thanh toán
                </Text>
              </View>
            )}

            {/* QR code */}
            {activeQR && !isCancelled && (
              <QRSection
                qrCode={activeQR}
                totalAmount={totalAmount || order.totalAmount}
                primaryColor={primaryColor}
                isDark={isDark}
                secondsShared={secondsShared}
                isExpired={isExpired}
              />
            )}
          </ScrollView>

          {/* Sticky footer */}
          {!isCancelled && (
            <View
              style={[
                s.footer,
                {
                  paddingBottom: bottom + 16,
                  backgroundColor: bg,
                  borderTopColor: borderColor,
                },
              ]}
            >
              {activeQR && !isExpired ? (
                // Already showing QR — refetch button
                <Pressable
                  onPress={() => void refetch()}
                  style={[s.footerBtn, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}
                >
                  <Text style={[s.footerBtnText, { color: textColor }]}>
                    Kiểm tra trạng thái
                  </Text>
                </Pressable>
              ) : isExpired ? (
                // Expired — retry by going back to checkout
                <Pressable
                  onPress={() => navigateNative.back()}
                  style={[s.footerBtn, { backgroundColor: primaryColor }]}
                >
                  <Text style={[s.footerBtnText, { color: colors.white.light }]}>
                    Đặt hàng lại
                  </Text>
                </Pressable>
              ) : (
                // Initial — show pay button
                <Pressable
                  onPress={handleInitiatePayment}
                  disabled={isInitiating}
                  style={[s.footerBtn, { backgroundColor: primaryColor, opacity: isInitiating ? 0.7 : 1 }]}
                >
                  {isInitiating ? (
                    <ActivityIndicator color={colors.white.light} />
                  ) : (
                    <Text style={[s.footerBtnText, { color: colors.white.light }]}>
                      Tạo mã QR thanh toán
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },

  infoRows: { gap: 10 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoKey: { fontSize: 14 },
  infoVal: { fontSize: 14, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },

  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: { flex: 1, gap: 2 },
  methodLabel: { fontSize: 14, fontWeight: '600' },
  methodDesc: { fontSize: 12 },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  cancelledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelledText: { fontSize: 14, fontWeight: '600', flex: 1 },

  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { fontSize: 16, fontWeight: '700' },
})
