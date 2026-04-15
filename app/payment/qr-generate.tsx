import { FloatingHeader } from '@/components/navigation/floating-header'
import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { QR_TTL_S, useQRPayment } from '@/hooks/use-qr-payment'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const QR_FADE_IN_MS = 250
const QR_FADE_OUT_MS = 150
const HEADER_HEIGHT = 56
const QR_SIZE = 220

// ─── Progress Bar (Reanimated — UI Thread) ────────────────────────────────────

const ProgressBar = memo(function ProgressBar({
  qrCode,
  primary,
  isDark,
  ttlMs,
}: {
  qrCode: string | null
  primary: string
  isDark: boolean
  ttlMs: number
}) {
  const containerWidth = useSharedValue(0)
  const progress = useSharedValue(1)

  useEffect(() => {
    if (!qrCode) return
    cancelAnimation(progress)
    progress.value = 1
    progress.value = withTiming(0, { duration: ttlMs })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrCode, ttlMs])

  const barStyle = useAnimatedStyle(() => ({
    width: progress.value * containerWidth.value,
  }))

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    containerWidth.value = e.nativeEvent.layout.width
  // containerWidth is a Reanimated shared value (ref-like) — stable, no dep needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trackBg = isDark ? colors.gray[700] : colors.gray[200]

  return (
    <View
      style={[s.progressTrack, { backgroundColor: trackBg }]}
      onLayout={handleLayout}
    >
      <Animated.View style={[s.progressBar, { backgroundColor: primary }, barStyle]} />
    </View>
  )
})

// ─── Active QR — owns Reanimated hooks, không có conditional return ───────────

const ActiveQR = memo(function ActiveQR({
  token,
  isRefreshing,
  countdown,
  isDark,
  primary,
}: {
  token: string
  isRefreshing: boolean
  countdown: number
  isDark: boolean
  primary: string
}) {
  const { t } = useTranslation('payment')
  const { mutedColor, cardBg } = useMemo(
    () => ({
      mutedColor: isDark ? colors.gray[400] : colors.gray[500],
      cardBg: isDark ? colors.gray[800] : colors.white.light,
    }),
    [isDark],
  )
  const countdownColor = useMemo(
    () => (countdown <= 10 ? colors.destructive.light : primary),
    [countdown, primary],
  )

  const qrOpacity = useSharedValue(1)

  useEffect(() => {
    if (isRefreshing) {
      qrOpacity.value = withTiming(0.35, { duration: QR_FADE_OUT_MS })
    } else {
      qrOpacity.value = withTiming(1, { duration: QR_FADE_IN_MS })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshing])

  const qrAnimStyle = useAnimatedStyle(() => ({ opacity: qrOpacity.value }))

  const qrWrapStyle = useMemo(
    () => [s.qrImageWrap, qrAnimStyle],
    [qrAnimStyle],
  )

  return (
    <View style={[s.qrCard, { backgroundColor: cardBg }]}>
      <Animated.View style={qrWrapStyle}>
        <QRCode value={token} size={QR_SIZE} />
      </Animated.View>

      <ProgressBar
        qrCode={token}
        primary={primary}
        isDark={isDark}
        ttlMs={QR_TTL_S * 1000}
      />

      <Text style={[s.countdownText, { color: mutedColor }]}>
        {t('qrGenerate.expiresIn')}{' '}
        <Text style={[s.countdownHighlight, { color: countdownColor }]}>
          {countdown}s
        </Text>
      </Text>
    </View>
  )
})

// ─── QR Card — dispatcher, không có hooks riêng ───────────────────────────────

const QRCard = memo(function QRCard({
  token,
  isLoading,
  isRefreshing,
  countdown,
  error,
  onRetry,
  isDark,
  primary,
}: {
  token: string | null
  isLoading: boolean
  isRefreshing: boolean
  countdown: number
  error: string | null
  onRetry: () => void
  isDark: boolean
  primary: string
}) {
  const { t } = useTranslation('payment')
  const { mutedColor, cardBg, skeletonWrapStyle } = useMemo(
    () => {
      const skBg = isDark ? colors.gray[700] : colors.gray[100]
      return {
        mutedColor: isDark ? colors.gray[400] : colors.gray[500],
        cardBg: isDark ? colors.gray[800] : colors.white.light,
        skeletonWrapStyle: [s.qrImageWrap, { backgroundColor: skBg }],
      }
    },
    [isDark],
  )

  if (isLoading) {
    return (
      <View style={[s.qrCard, { backgroundColor: cardBg }]}>
        <View style={skeletonWrapStyle}>
          <ActivityIndicator color={primary} size="large" />
        </View>
        <Text style={[s.countdownText, { color: mutedColor }]}>
          {t('qrGenerate.generating')}
        </Text>
      </View>
    )
  }

  if (error && !token) {
    return (
      <View style={[s.qrCard, { backgroundColor: cardBg }]}>
        <View style={skeletonWrapStyle}>
          <Text style={s.errorIcon}>⚠️</Text>
        </View>
        <Text style={[s.errorText, { color: mutedColor }]}>{error}</Text>
        <Pressable style={[s.retryBtn, { borderColor: primary }]} onPress={onRetry}>
          <Text style={[s.retryText, { color: primary }]}>{t('qrGenerate.retry')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ActiveQR
      token={token!}
      isRefreshing={isRefreshing}
      countdown={countdown}
      isDark={isDark}
      primary={primary}
    />
  )
})

// ─── Instructions ─────────────────────────────────────────────────────────────

const Instructions = memo(function Instructions({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation('payment')
  const steps = useMemo(
    () => [
      t('qrGenerate.step1'),
      t('qrGenerate.step2'),
      t('qrGenerate.step3'),
    ],
    [t],
  )
  const { textColor, mutedColor, cardBg } = useMemo(
    () => ({
      textColor: isDark ? colors.gray[50] : colors.gray[900],
      mutedColor: isDark ? colors.gray[400] : colors.gray[500],
      cardBg: isDark ? colors.gray[800] : colors.white.light,
    }),
    [isDark],
  )

  return (
    <View style={[s.instructionCard, { backgroundColor: cardBg }]}>
      {steps.map((step, i) => (
        <View key={step} style={s.stepRow}>
          <View style={[s.stepNum, { backgroundColor: mutedColor }]}>
            <Text style={s.stepNumText}>{i + 1}</Text>
          </View>
          <Text style={[s.stepText, { color: textColor }]}>{step}</Text>
        </View>
      ))}
    </View>
  )
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QRGenerateScreen() {
  const { t } = useTranslation('payment')
  const isDark = useColorScheme() === 'dark'

  const primary = useMemo(
    () => isDark ? colors.primary.dark : colors.primary.light,
    [isDark],
  )
  const bg = useMemo(
    () => isDark ? colors.background.dark : colors.background.light,
    [isDark],
  )

  const { token, countdown, isLoading, isRefreshing, error, refetch } =
    useQRPayment()

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <FloatingHeader title={t('qrGenerate.title')} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <QRCard
          token={token}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          countdown={countdown}
          error={error}
          onRetry={refetch}
          isDark={isDark}
          primary={primary}
        />
        <Instructions isDark={isDark} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
    paddingTop: STATIC_TOP_INSET + HEADER_HEIGHT + 12,
  },
  qrCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  qrImageWrap: {
    width: QR_SIZE + 32,
    height: QR_SIZE + 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // qrImage: {
  //   width: QR_SIZE,
  //   height: QR_SIZE,
  // },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  countdownText: { fontSize: 14 },
  countdownHighlight: { fontWeight: '700' },
  errorIcon: { fontSize: 48 },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  retryText: { fontSize: 15, fontWeight: '600' },
  instructionCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
})
