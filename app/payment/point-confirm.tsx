/**
 * Xác nhận và trả xu cho đơn sau khi quét QR (route /payment/point-confirm).
 *
 * Bố cục kiểu chuyển khoản ngân hàng: người nhận (cửa hàng, chi nhánh) → số
 * xu → nguồn tiền (ví xu). Bấm "Thanh toán" mở hộp thoại xác nhận, xác nhận
 * xong mới gọi API. Trả xong hiện biên lai.
 *
 * Nhận `qrData` qua params. Kết quả xem trước đã nằm trong cache từ màn quét
 * nên màn hiện ngay; cache trống (mở lại app giữa chừng) thì tự gọi lại.
 *
 * Mất mạng, hoặc không rõ lỗi (ví dụ 502/504 từ proxy) lúc đang trả là
 * trường hợp nguy hiểm nhất: xu có thể đã bị trừ mà app không nhận được
 * phản hồi, hoặc nhận phản hồi không đọc được mã lỗi. Trả lại ngay thì
 * server báo 160207 và app không phân biệt được do chính khách vừa trả hay
 * người khác. Vì vậy hỏi lại trạng thái QR trước (`recheck`), chỉ cho thử
 * lại khi QR vẫn chờ trả.
 */
import dayjs from 'dayjs'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Check } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PointConfirmDialog } from '@/app/payment/payment-point-confirm-dialog'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { FOOTER_BOTTOM_EXTRA, STATIC_TOP_INSET } from '@/constants/status-bar'
import { useCoinBalance } from '@/hooks/use-coin-balance'
import { useOrderBySlug } from '@/hooks/use-order'
import {
  usePayPointPaymentQr,
  usePointPaymentQrPreview,
} from '@/hooks/use-point-payment-qr'
import { formatCurrency } from '@/utils'
import {
  classifyPointQrError,
  previewOutcome,
  type PointQrErrorKind,
} from '@/utils/point-payment-qr'
import { showErrorToast } from '@/utils/toast'

const HEADER_HEIGHT = 56

type Phase =
  | { kind: 'ready' }
  | { kind: 'paying' }
  | { kind: 'rechecking' }
  | { kind: 'success'; amount: number; newBalance: number; paidAt?: string }
  | { kind: 'failed'; error: PointQrErrorKind }
  | { kind: 'uncertain'; outcome: 'safeToRetry' | 'maybePaid' | 'stillOffline' }

// formatCurrency(value, '') trả về kèm một dấu cách cuối ("6.400 "); cắt đi để
// "6.400 xu" không bị hai dấu cách.
const num = (value: number) => formatCurrency(value, '').trim()

export default function PointConfirmScreen() {
  const { t } = useTranslation('payment')
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const { bottom } = useSafeAreaInsets()
  const { qrData } = useLocalSearchParams<{ qrData?: string }>()

  const preview = usePointPaymentQrPreview(qrData)
  const refetchPreview = preview.refetch
  const order = useOrderBySlug(preview.data?.orderSlug)
  // BE chỉ cấp số thứ tự khi đơn đã trả (job.service), nên lúc xác nhận
  // thường chưa có. Khi đó dùng slug đơn, giống hoá đơn phía BE.
  const referenceNumber = order.data?.result?.referenceNumber
  const orderCode = referenceNumber
    ? `#${referenceNumber}`
    : (preview.data?.orderSlug ?? '')
  const {
    balance,
    isLoading: balanceLoading,
    isError: balanceError,
    refetch: refetchBalance,
  } = useCoinBalance()
  const { mutate: pay } = usePayPointPaymentQr()
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Chặn double tap gọi pay() hai lần trước khi setPhase({ kind: 'paying' })
  // kịp render lại (prop disabled chỉ có tác dụng sau render đó). Với
  // TanStack v5, chỉ callback của lần gọi mutate() cuối chạy, nên lần trả
  // đầu thành công có thể bị báo nhầm thành thất bại (alreadyPaid).
  const payingRef = useRef(false)

  const busy = phase.kind === 'paying' || phase.kind === 'rechecking'

  // Android: chặn nút back cứng khi đang trả. iOS: tắt vuốt back ở Stack.Screen.
  useEffect(() => {
    if (!busy) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [busy])

  const recheck = useCallback(async () => {
    setPhase({ kind: 'rechecking' })
    const result = await refetchPreview()
    if (result.error) {
      const kind = classifyPointQrError(result.error)
      setPhase(
        kind === 'network' || kind === 'unknown'
          ? { kind: 'uncertain', outcome: 'stillOffline' }
          : { kind: 'failed', error: kind },
      )
      return
    }
    if (!result.data) {
      setPhase({ kind: 'uncertain', outcome: 'stillOffline' })
      return
    }
    const outcome = previewOutcome(result.data)
    if (outcome === 'confirm') {
      setPhase({ kind: 'uncertain', outcome: 'safeToRetry' })
    } else if (outcome === 'alreadyPaid') {
      setPhase({ kind: 'uncertain', outcome: 'maybePaid' })
    } else {
      setPhase({ kind: 'failed', error: outcome })
    }
  }, [refetchPreview])

  const handlePay = useCallback(() => {
    if (!qrData || payingRef.current) return
    payingRef.current = true
    setPhase({ kind: 'paying' })
    pay(qrData, {
      // Số dư mới tính từ số dư lúc bấm trả: số dư từ server về chậm hơn
      // (invalidate + refetch) và sẽ nháy số cũ.
      onSuccess: (qr) =>
        setPhase({
          kind: 'success',
          amount: qr.amount,
          newBalance: balance - qr.amount,
          paidAt: qr.paidAt,
        }),
      onError: (error) => {
        const kind = classifyPointQrError(error)
        if (kind === 'network' || kind === 'unknown') {
          void recheck()
          return
        }
        if (kind === 'insufficient') {
          showErrorToast(158205)
          void refetchBalance()
          setPhase({ kind: 'ready' })
          return
        }
        setPhase({ kind: 'failed', error: kind })
      },
      onSettled: () => {
        payingRef.current = false
      },
    })
  }, [balance, pay, qrData, recheck, refetchBalance])

  const openConfirm = useCallback(() => setConfirmOpen(true), [])
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  const handleConfirmPay = useCallback(() => {
    setConfirmOpen(false)
    handlePay()
  }, [handlePay])

  const handleBack = useCallback(() => {
    if (busy) return
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/profile' as never)
    }
  }, [busy, router])

  const handleRescan = useCallback(() => {
    router.replace('/payment/scan-point' as never)
  }, [router])

  const handleViewHistory = useCallback(() => {
    router.replace('/profile/coin-hub' as never)
  }, [router])

  const handleRecheck = useCallback(() => {
    void recheck()
  }, [recheck])

  const palette: Palette = {
    bg: isDark ? colors.background.dark : colors.background.light,
    card: isDark ? colors.card.dark : colors.white.light,
    text: isDark ? colors.gray[50] : colors.gray[900],
    muted: isDark ? colors.gray[400] : colors.gray[500],
    border: isDark ? colors.border.dark : colors.gray[200],
    primary: isDark ? colors.primary.dark : colors.primary.light,
    primarySoft: isDark ? 'rgba(214,137,16,0.18)' : 'rgba(247,167,55,0.14)',
    danger: isDark ? colors.destructive.dark : colors.destructive.light,
    success: isDark ? colors.success.dark : colors.success.light,
    successSoft: isDark ? colors.success.bgDark : colors.success.iconBgLight,
  }
  const unit = t('pointQr.confirm.unit')
  const fmt = (value: number) => `${num(value)} ${unit}`
  const branchName = preview.data?.branchName

  let body: ReactNode
  let footer: ReactNode = null

  if (phase.kind === 'success') {
    body = (
      <>
        <View style={s.okHead}>
          <View
            style={[s.checkOuter, { backgroundColor: palette.successSoft }]}
          >
            <View style={[s.checkInner, { backgroundColor: palette.success }]}>
              <Check size={20} color={colors.white.light} strokeWidth={3} />
            </View>
          </View>
          <Text style={[s.okTitle, { color: palette.text }]}>
            {t('pointQr.confirm.successTitle')}
          </Text>
          <Text style={[s.okAmount, { color: palette.text }]}>
            {fmt(phase.amount)}
          </Text>
        </View>
        <View style={[s.card, { backgroundColor: palette.card }]}>
          <Row
            palette={palette}
            label={t('pointQr.confirm.store')}
            value={
              branchName
                ? `${t('pointQr.confirm.merchant')} · ${branchName}`
                : t('pointQr.confirm.merchant')
            }
          />
          {orderCode ? (
            <Row
              palette={palette}
              label={t('pointQr.confirm.order')}
              value={orderCode}
              divided
            />
          ) : null}
          <Row
            palette={palette}
            label={t('pointQr.confirm.time')}
            value={dayjs(phase.paidAt).format('HH:mm · DD/MM/YYYY')}
            divided
          />
          <Row
            palette={palette}
            label={t('pointQr.confirm.newBalance')}
            value={fmt(phase.newBalance)}
            divided
          />
        </View>
      </>
    )
    footer = (
      <>
        <PrimaryButton
          palette={palette}
          label={t('pointQr.confirm.done')}
          onPress={handleBack}
        />
        <SecondaryButton
          palette={palette}
          label={t('pointQr.confirm.viewHistory')}
          onPress={handleViewHistory}
        />
      </>
    )
  } else if (phase.kind === 'rechecking') {
    body = (
      <Loading palette={palette} label={t('pointQr.confirm.checkingResult')} />
    )
  } else if (phase.kind === 'uncertain') {
    body =
      phase.outcome === 'safeToRetry' ? (
        <Message
          palette={palette}
          body={t('pointQr.confirm.safeToRetry')}
          primary={{ label: t('pointQr.confirm.retry'), onPress: handlePay }}
          secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
        />
      ) : phase.outcome === 'maybePaid' ? (
        <Message
          palette={palette}
          body={t('pointQr.confirm.maybePaid')}
          primary={{
            label: t('pointQr.confirm.viewHistory'),
            onPress: handleViewHistory,
          }}
          secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
        />
      ) : (
        <Message
          palette={palette}
          body={t('pointQr.confirm.stillOffline')}
          primary={{
            label: t('pointQr.confirm.checkAgain'),
            onPress: handleRecheck,
          }}
          secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
        />
      )
  } else if (phase.kind === 'failed') {
    body = (
      <Message
        palette={palette}
        body={t(`pointQr.errors.${phase.error}`)}
        primary={{ label: t('pointQr.confirm.rescan'), onPress: handleRescan }}
        secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
      />
    )
  } else if (!qrData) {
    body = (
      <Message
        palette={palette}
        body={t('pointQr.errors.invalid')}
        primary={{ label: t('pointQr.confirm.rescan'), onPress: handleRescan }}
        secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
      />
    )
  } else if (preview.isPending) {
    body = <Loading palette={palette} />
  } else if (preview.error || !preview.data) {
    body = (
      <Message
        palette={palette}
        body={t(`pointQr.errors.${classifyPointQrError(preview.error)}`)}
        primary={{ label: t('pointQr.confirm.rescan'), onPress: handleRescan }}
        secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
      />
    )
  } else if (previewOutcome(preview.data) !== 'confirm') {
    // Mở lại màn khi QR đã đổi trạng thái (cache từ lần trước).
    const outcome = previewOutcome(preview.data)
    body = (
      <Message
        palette={palette}
        body={t(`pointQr.errors.${outcome}`)}
        primary={{ label: t('pointQr.confirm.rescan'), onPress: handleRescan }}
        secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
      />
    )
  } else if (balanceError) {
    body = (
      <Message
        palette={palette}
        body={t('pointQr.errors.network')}
        primary={{
          label: t('pointQr.confirm.checkAgain'),
          onPress: () => void refetchBalance(),
        }}
        secondary={{ label: t('pointQr.confirm.close'), onPress: handleBack }}
      />
    )
  } else {
    const { amount } = preview.data
    const short = balanceLoading ? 0 : amount - balance
    const paying = phase.kind === 'paying'
    const blocked = balanceLoading || short > 0 || paying
    body = (
      <>
        <View style={[s.merchant, { backgroundColor: palette.card }]}>
          <View style={[s.logo, { backgroundColor: palette.primary }]}>
            <Text style={s.logoText}>TC</Text>
          </View>
          <View style={s.merchantText}>
            <Text style={[s.merchantName, { color: palette.text }]}>
              {t('pointQr.confirm.merchant')}
            </Text>
            {branchName ? (
              <Text
                style={[s.merchantSub, { color: palette.muted }]}
                numberOfLines={1}
              >
                {branchName}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={s.amountBlock}>
          <Text style={[s.amountLabel, { color: palette.muted }]}>
            {t('pointQr.confirm.amount')}
          </Text>
          <Text style={[s.amount, { color: palette.text }]}>
            {num(amount)}
            <Text style={[s.amountUnit, { color: palette.muted }]}>
              {' '}
              {unit}
            </Text>
          </Text>
        </View>

        {orderCode ? (
          <View style={[s.card, { backgroundColor: palette.card }]}>
            <Row
              palette={palette}
              label={t('pointQr.confirm.order')}
              value={orderCode}
            />
          </View>
        ) : null}

        <View style={[s.source, { backgroundColor: palette.card }]}>
          <View style={[s.coin, { backgroundColor: palette.primarySoft }]}>
            <Text style={[s.coinText, { color: palette.primary }]}>X</Text>
          </View>
          <View style={s.sourceText}>
            <Text style={[s.sourceName, { color: palette.text }]}>
              {t('pointQr.confirm.wallet')}
            </Text>
            <Text style={[s.sourceSub, { color: palette.muted }]}>
              {balanceLoading
                ? '—'
                : t('pointQr.confirm.balanceLine', { amount: num(balance) })}
            </Text>
          </View>
          <View style={s.after}>
            {short > 0 ? (
              <Text style={[s.afterValue, { color: palette.danger }]}>
                {t('pointQr.confirm.short', { amount: num(short) })}
              </Text>
            ) : (
              <>
                <Text style={[s.afterLabel, { color: palette.muted }]}>
                  {t('pointQr.confirm.remaining')}
                </Text>
                <Text style={[s.afterValue, { color: palette.text }]}>
                  {balanceLoading ? '—' : fmt(balance - amount)}
                </Text>
              </>
            )}
          </View>
        </View>

        <Text style={[s.note, { color: palette.muted }]}>
          {t('pointQr.confirm.loyaltyNote')}
        </Text>
      </>
    )
    footer = (
      <Pressable
        style={[
          s.primaryBtn,
          { backgroundColor: palette.primary },
          blocked && s.disabled,
        ]}
        onPress={openConfirm}
        disabled={blocked}
        accessibilityRole="button"
      >
        {paying ? (
          <ActivityIndicator color={colors.white.light} />
        ) : (
          <Text style={s.primaryText}>
            {t('pointQr.confirm.pay', { amount: num(amount) })}
          </Text>
        )}
      </Pressable>
    )
  }

  const title =
    phase.kind === 'success'
      ? t('pointQr.confirm.receiptTitle')
      : t('pointQr.confirm.title')

  return (
    <View style={[s.root, { backgroundColor: palette.bg }]}>
      <Stack.Screen
        options={{ gestureEnabled: !busy, fullScreenGestureEnabled: !busy }}
      />
      <ScrollView
        contentContainerStyle={[
          s.content,
          {
            paddingTop: STATIC_TOP_INSET + HEADER_HEIGHT + 8,
            paddingBottom: footer ? 16 : bottom + FOOTER_BOTTOM_EXTRA,
          },
        ]}
      >
        {body}
      </ScrollView>
      {footer ? (
        <View
          style={[s.footer, { paddingBottom: bottom + FOOTER_BOTTOM_EXTRA }]}
        >
          {footer}
        </View>
      ) : null}
      <FloatingHeader title={title} onBack={handleBack} />
      {preview.data ? (
        <PointConfirmDialog
          visible={confirmOpen}
          onClose={closeConfirm}
          onConfirm={handleConfirmPay}
          orderSubtotal={preview.data.amount}
          coinBalance={balance}
          primaryColor={palette.primary}
          isDark={isDark}
        />
      ) : null}
    </View>
  )
}

type Palette = {
  bg: string
  card: string
  text: string
  muted: string
  border: string
  primary: string
  primarySoft: string
  danger: string
  success: string
  successSoft: string
}

function Row({
  palette,
  label,
  value,
  divided,
}: {
  palette: Palette
  label: string
  value: string
  divided?: boolean
}) {
  return (
    <View
      style={[
        s.row,
        divided && s.rowDivided,
        divided && { borderTopColor: palette.border },
      ]}
    >
      <Text style={[s.rowLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[s.rowValue, { color: palette.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function Loading({ palette, label }: { palette: Palette; label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={palette.primary} />
      {label ? (
        <Text style={[s.note, { color: palette.muted }]}>{label}</Text>
      ) : null}
    </View>
  )
}

type Action = { label: string; onPress: () => void }

function PrimaryButton({
  palette,
  label,
  onPress,
}: Action & { palette: Palette }) {
  return (
    <Pressable
      style={[s.primaryBtn, { backgroundColor: palette.primary }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  )
}

function SecondaryButton({
  palette,
  label,
  onPress,
}: Action & { palette: Palette }) {
  return (
    <Pressable
      style={[s.secondaryBtn, { borderColor: palette.border }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[s.secondaryText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  )
}

function Message({
  palette,
  body,
  primary,
  secondary,
}: {
  palette: Palette
  body: string
  primary: Action
  secondary: Action
}) {
  return (
    <View style={s.message}>
      <Text style={[s.messageBody, { color: palette.text }]}>{body}</Text>
      <PrimaryButton palette={palette} {...primary} />
      <SecondaryButton palette={palette} {...secondary} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },

  merchant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 12,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.white.light, fontSize: 14, fontWeight: '800' },
  merchantText: { flex: 1, minWidth: 0 },
  merchantName: { fontSize: 15, fontWeight: '700' },
  merchantSub: { fontSize: 13 },

  amountBlock: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  amountLabel: { fontSize: 13 },
  amount: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  amountUnit: { fontSize: 18, fontWeight: '700' },

  card: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 14, flexShrink: 0 },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },
  coin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { fontSize: 15, fontWeight: '800' },
  sourceText: { flex: 1, minWidth: 0 },
  sourceName: { fontSize: 14, fontWeight: '600' },
  sourceSub: { fontSize: 13, fontVariant: ['tabular-nums'] },
  after: { alignItems: 'flex-end' },
  afterLabel: { fontSize: 12 },
  afterValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  okHead: { alignItems: 'center', gap: 4, paddingTop: 12, paddingBottom: 8 },
  checkOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  checkInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okTitle: { fontSize: 17, fontWeight: '700' },
  okAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },

  note: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.white.light, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  loading: { alignItems: 'center', gap: 12, paddingTop: 48 },
  message: { gap: 14, paddingTop: 24 },
  messageBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
