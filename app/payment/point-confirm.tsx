/**
 * Xác nhận và trả xu cho đơn sau khi quét QR (route /payment/point-confirm).
 *
 * Thông tin gom trong một card dạng vé, như màn xác nhận chuyển khoản của app
 * ngân hàng: các dòng cửa hàng, chi nhánh, đơn, nguồn tiền; số xu cần trả nằm
 * ở cuống vé. Bấm "Thanh toán" mở hộp thoại xác nhận, xác nhận xong mới gọi
 * API. Trả xong hiện biên lai.
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
import { Check, Info, TriangleAlert } from 'lucide-react-native'
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
import { useUserStore } from '@/stores'
import {
  usePayPointPaymentQr,
  usePointPaymentQrPreview,
} from '@/hooks/use-point-payment-qr'
import { formatCurrency } from '@/utils'
import { numberToVietnameseWords } from '@/utils/number-to-vietnamese-words'
import { wasPointQrScanned } from '@/utils/point-qr-handoff'
import {
  classifyPointQrError,
  pointQrOrderOwnership,
  previewOutcome,
  type PointQrErrorKind,
} from '@/utils/point-payment-qr'
import { showErrorToast } from '@/utils/toast'

const HEADER_HEIGHT = 56

// Nét đứt của đường xé vẽ bằng các gạch ngắn: iOS không vẽ borderStyle
// 'dashed' khi chỉ có viền một cạnh. Thừa gạch thì overflow hidden cắt đi.
const TEAR_DASHES = Array.from({ length: 48 }, (_, i) => i)

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
  const { t, i18n } = useTranslation('payment')
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
  // Chủ đơn tự quét QR đơn mình (BE cho phép) hay trả hộ người khác: quyết
  // định câu về điểm tích lũy và nội dung biên lai. Lấy đơn lỗi → 'unknown'.
  const userSlug = useUserStore((st) => st.userInfo?.slug)
  const ownership = pointQrOrderOwnership(
    order.data?.result?.owner?.slug,
    userSlug,
  )
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

  const orderSlug = preview.data?.orderSlug
  const handleViewOrder = useCallback(() => {
    if (!orderSlug) return
    router.replace(`/order/${orderSlug}` as never)
  }, [orderSlug, router])

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
    warning: isDark ? colors.warning.dark : colors.warning.light,
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
            {ownership === 'other'
              ? t('pointQr.confirm.successTitleOther')
              : t('pointQr.confirm.successTitle')}
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
          {ownership !== 'unknown' ? (
            <Row
              palette={palette}
              label={t('pointQr.confirm.orderedBy')}
              value={
                ownership === 'mine'
                  ? t('pointQr.confirm.orderedByYou')
                  : t('pointQr.confirm.orderedByOther')
              }
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
        {ownership === 'mine' ? (
          <SecondaryButton
            palette={palette}
            label={t('pointQr.confirm.viewOrder')}
            onPress={handleViewOrder}
          />
        ) : (
          <SecondaryButton
            palette={palette}
            label={t('pointQr.confirm.viewHistory')}
            onPress={handleViewHistory}
          />
        )}
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
  } else if (!qrData || !wasPointQrScanned(qrData)) {
    // Không có mã, hoặc mã không đi qua màn quét (mở bằng deep link).
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
    // Bố cục vé: dải nhắc kiểm tra → các dòng thông tin (nhãn trái, giá trị
    // đậm bên phải, như màn xác nhận chuyển khoản) → đường xé → cuống vé chỉ
    // chứa số xu cần trả, kèm số bằng chữ với tiếng Việt.
    body = (
      <>
        <View style={[s.ticket, { backgroundColor: palette.card }]}>
          <View style={[s.notice, { backgroundColor: palette.primarySoft }]}>
            <Info size={22} color={palette.primary} strokeWidth={2.25} />
            <Text style={[s.noticeText, { color: palette.muted }]}>
              {t('pointQr.confirm.noticeLead')}
              <Text style={[s.noticeBold, { color: palette.text }]}>
                {t('pointQr.confirm.noticeBold')}
              </Text>
              {t('pointQr.confirm.noticeTail')}
            </Text>
          </View>

          <View style={s.infoRows}>
            <InfoRow
              palette={palette}
              label={t('pointQr.confirm.store')}
              value={t('pointQr.confirm.merchant')}
            />
            {branchName ? (
              <InfoRow
                palette={palette}
                label={t('pointQr.confirm.branch')}
                value={branchName}
              />
            ) : null}
            {orderCode ? (
              <InfoRow
                palette={palette}
                label={t('pointQr.confirm.order')}
                value={orderCode}
              />
            ) : null}
            <InfoRow
              palette={palette}
              label={t('pointQr.confirm.source')}
              value={t('pointQr.confirm.wallet')}
              sub={
                balanceLoading
                  ? undefined
                  : t('pointQr.confirm.balanceLine', { amount: num(balance) })
              }
            />
            <InfoRow
              palette={palette}
              label={t('pointQr.confirm.balanceAfter')}
              value={
                balanceLoading
                  ? '—'
                  : short > 0
                    ? t('pointQr.confirm.short', { amount: num(short) })
                    : fmt(balance - amount)
              }
              valueColor={short > 0 ? palette.danger : undefined}
            />
          </View>

          <View style={s.tear}>
            <View style={s.tearLine} pointerEvents="none">
              {TEAR_DASHES.map((i) => (
                <View
                  key={i}
                  style={[s.dash, { backgroundColor: palette.border }]}
                />
              ))}
            </View>
            <View
              style={[s.notch, s.notchLeft, { backgroundColor: palette.bg }]}
            />
            <View
              style={[s.notch, s.notchRight, { backgroundColor: palette.bg }]}
            />
          </View>

          <View style={s.stub}>
            <Text style={[s.stubLabel, { color: palette.muted }]}>
              {t('pointQr.confirm.amount')}
            </Text>
            <View style={s.stubValue}>
              <Text style={[s.stubAmount, { color: palette.primary }]}>
                {num(amount)}
                <Text style={[s.stubUnit, { color: palette.primary }]}>
                  {' '}
                  {unit}
                </Text>
              </Text>
              {i18n.language?.startsWith('vi') ? (
                <Text style={[s.stubWords, { color: palette.muted }]}>
                  ({numberToVietnameseWords(amount)} {unit})
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[s.warning, { borderColor: palette.border }]}>
          <TriangleAlert size={16} color={palette.warning} />
          <Text style={[s.warningText, { color: palette.text }]}>
            {t('pointQr.confirm.scamWarning')}
          </Text>
        </View>

        <Text style={[s.note, { color: palette.muted }]}>
          {ownership === 'mine'
            ? t('pointQr.confirm.loyaltyNoteMine')
            : ownership === 'other'
              ? t('pointQr.confirm.loyaltyNoteOther')
              : t('pointQr.confirm.loyaltyNote')}
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
          <Text style={s.primaryText}>{t('pointQr.confirm.pay')}</Text>
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
            paddingTop: STATIC_TOP_INSET + HEADER_HEIGHT + 16,
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
  warning: string
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

function InfoRow({
  palette,
  label,
  value,
  sub,
  valueColor,
}: {
  palette: Palette
  label: string
  value: string
  sub?: string
  valueColor?: string
}) {
  return (
    <View style={s.infoRow}>
      <Text style={[s.infoLabel, { color: palette.muted }]}>{label}</Text>
      <View style={s.infoValueWrap}>
        <Text style={[s.infoValue, { color: valueColor ?? palette.text }]}>
          {value}
        </Text>
        {sub ? (
          <Text style={[s.infoSub, { color: palette.muted }]}>{sub}</Text>
        ) : null}
      </View>
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

  ticket: { borderRadius: 18, overflow: 'hidden' },

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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  noticeBold: { fontWeight: '700' },
  infoRows: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
  },
  infoLabel: { fontSize: 14, flexShrink: 0, maxWidth: '45%' },
  infoValueWrap: { flex: 1, alignItems: 'flex-end' },
  infoValue: {
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  infoSub: {
    fontSize: 12.5,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  // Đường xé của vé: nét đứt giữa hai lỗ khuyết cùng màu nền màn hình.
  tear: { height: 24, justifyContent: 'center' },
  tearLine: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 18,
    overflow: 'hidden',
  },
  dash: { width: 6, height: 1.5, borderRadius: 1 },
  notch: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  stub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 18,
  },
  stubLabel: { fontSize: 14, paddingTop: 10 },
  stubValue: { flex: 1, alignItems: 'flex-end' },
  stubAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  stubUnit: { fontSize: 15, fontWeight: '700' },
  stubWords: { fontSize: 12.5, textAlign: 'right', marginTop: 2 },

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

  warning: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
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
