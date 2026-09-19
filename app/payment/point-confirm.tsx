/**
 * Xác nhận và trả xu cho đơn sau khi quét QR (route /payment/point-confirm).
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
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
  | { kind: 'success'; amount: number; newBalance: number }
  | { kind: 'failed'; error: PointQrErrorKind }
  | { kind: 'uncertain'; outcome: 'safeToRetry' | 'maybePaid' | 'stillOffline' }

export default function PointConfirmScreen() {
  const { t } = useTranslation('payment')
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const { bottom } = useSafeAreaInsets()
  const { qrData } = useLocalSearchParams<{ qrData?: string }>()

  const preview = usePointPaymentQrPreview(qrData)
  const refetchPreview = preview.refetch
  const order = useOrderBySlug(preview.data?.orderSlug)
  const referenceNumber = order.data?.result?.referenceNumber
  const {
    balance,
    isLoading: balanceLoading,
    isError: balanceError,
    refetch: refetchBalance,
  } = useCoinBalance()
  const { mutate: pay } = usePayPointPaymentQr()
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
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

  const palette = {
    bg: isDark ? colors.background.dark : colors.background.light,
    card: isDark ? colors.card.dark : colors.white.light,
    text: isDark ? colors.gray[50] : colors.gray[900],
    muted: isDark ? colors.gray[400] : colors.gray[500],
    border: isDark ? colors.border.dark : colors.gray[200],
    primary: isDark ? colors.primary.dark : colors.primary.light,
    danger: isDark ? colors.destructive.dark : colors.destructive.light,
  }
  const unit = t('pointQr.confirm.unit')
  const fmt = (value: number) => `${formatCurrency(value, '')} ${unit}`

  let body: ReactNode

  if (phase.kind === 'success') {
    body = (
      <Message
        palette={palette}
        title={t('pointQr.confirm.successTitle')}
        body={
          referenceNumber
            ? t('pointQr.confirm.successBody', {
                amount: formatCurrency(phase.amount, ''),
                order: referenceNumber,
              })
            : t('pointQr.confirm.successBodyNoOrder', {
                amount: formatCurrency(phase.amount, ''),
              })
        }
        extra={
          <Row
            palette={palette}
            label={t('pointQr.confirm.newBalance')}
            value={fmt(phase.newBalance)}
          />
        }
        primary={{
          label: t('pointQr.confirm.done'),
          onPress: handleBack,
        }}
        secondary={{
          label: t('pointQr.confirm.viewHistory'),
          onPress: handleViewHistory,
        }}
      />
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
    const { amount, branchName } = preview.data
    const short = balanceLoading ? 0 : amount - balance
    const paying = phase.kind === 'paying'
    body = (
      <>
        <View
          style={[
            s.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[s.amountLabel, { color: palette.muted }]}>
            {t('pointQr.confirm.amount')}
          </Text>
          <Text style={[s.amount, { color: palette.text }]}>{fmt(amount)}</Text>
          {referenceNumber ? (
            <Row
              palette={palette}
              label={t('pointQr.confirm.order')}
              value={`#${referenceNumber}`}
            />
          ) : null}
          {branchName ? (
            <Row
              palette={palette}
              label={t('pointQr.confirm.branch')}
              value={branchName}
            />
          ) : null}
          <View style={[s.divider, { backgroundColor: palette.border }]} />
          <Row
            palette={palette}
            label={t('pointQr.confirm.currentBalance')}
            value={balanceLoading ? '—' : fmt(balance)}
          />
          <Row
            palette={palette}
            label={t('pointQr.confirm.balanceAfter')}
            value={balanceLoading || short > 0 ? '—' : fmt(balance - amount)}
          />
          {!balanceLoading && short > 0 ? (
            <Text style={[s.short, { color: palette.danger }]}>
              {t('pointQr.confirm.short', {
                amount: formatCurrency(short, ''),
              })}
            </Text>
          ) : null}
        </View>
        <Text style={[s.note, { color: palette.muted }]}>
          {t('pointQr.confirm.loyaltyNote')}
        </Text>
        <Pressable
          style={[
            s.primaryBtn,
            { backgroundColor: palette.primary },
            (balanceLoading || short > 0 || paying) && s.disabled,
          ]}
          onPress={handlePay}
          disabled={balanceLoading || short > 0 || paying}
          accessibilityRole="button"
        >
          {paying ? (
            <ActivityIndicator color={colors.white.light} />
          ) : (
            <Text style={s.primaryText}>
              {t('pointQr.confirm.pay', {
                amount: formatCurrency(amount, ''),
              })}
            </Text>
          )}
        </Pressable>
      </>
    )
  }

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
            paddingBottom: bottom + FOOTER_BOTTOM_EXTRA,
          },
        ]}
      >
        {body}
      </ScrollView>
      <FloatingHeader title={t('pointQr.confirm.title')} onBack={handleBack} />
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
  danger: string
}

function Row({
  palette,
  label,
  value,
}: {
  palette: Palette
  label: string
  value: string
}) {
  return (
    <View style={s.row}>
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

function Message({
  palette,
  title,
  body,
  extra,
  primary,
  secondary,
}: {
  palette: Palette
  title?: string
  body: string
  extra?: ReactNode
  primary: Action
  secondary: Action
}) {
  return (
    <View style={s.message}>
      {title ? (
        <Text style={[s.messageTitle, { color: palette.text }]}>{title}</Text>
      ) : null}
      <Text style={[s.messageBody, { color: palette.text }]}>{body}</Text>
      {extra}
      <Pressable
        style={[s.primaryBtn, { backgroundColor: palette.primary }]}
        onPress={primary.onPress}
        accessibilityRole="button"
      >
        <Text style={s.primaryText}>{primary.label}</Text>
      </Pressable>
      <Pressable
        style={[s.secondaryBtn, { borderColor: palette.border }]}
        onPress={secondary.onPress}
        accessibilityRole="button"
      >
        <Text style={[s.secondaryText, { color: palette.text }]}>
          {secondary.label}
        </Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  amountLabel: { fontSize: 13 },
  amount: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  short: { fontSize: 13, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  primaryBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.white.light, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  loading: { alignItems: 'center', gap: 12, paddingTop: 48 },
  message: { gap: 14, paddingTop: 24 },
  messageTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  messageBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
