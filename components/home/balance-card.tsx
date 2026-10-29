/**
 * BalanceCard — hai thẻ số dư trên Home.
 *
 * Đã đăng nhập: thẻ Xu (to, màu thương hiệu, có nút ẩn số) và thẻ Điểm tích
 * luỹ (nhỏ, thẻ trắng thường của app) — chỉ một mảng màu đậm trên Home. Mỗi
 * thẻ có một dải chân với lời gọi hành động; chạm vào đâu trên thẻ cũng mở
 * màn lịch sử của chính con số đó. Chưa đăng nhập: một thẻ mời đăng nhập.
 *
 * "Đã đăng nhập" quyết bằng userInfo — cùng tín hiệu Profile dùng để chọn
 * LoginPanel — chứ KHÔNG bằng isAuthenticated(): hàm đó trả false suốt lúc
 * refresh token đang bay, nên thẻ sẽ nháy lời mời đăng nhập mỗi lần mở app
 * sau khi access token hết hạn.
 *
 * Mọi màu, cỡ chữ, khoảng cách, bo góc đi từ hệ thống thiết kế của app —
 * __tests__/components/home/home-design-system.test.ts quét để giữ điều đó.
 */
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronRight, Eye, EyeOff } from 'lucide-react-native'
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { Skeleton } from '@/components/ui'
import { Text } from '@/components/ui/text'
import { MOTION, SPRING_CONFIGS, colors } from '@/constants'
import { useCoinBalance, useLoyaltyPoints } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { hexToRgba } from '@/lib/utils'
import { useUserStore } from '@/stores'
import { formatPoints } from '@/utils'

/**
 * Hiện khi lần tải đầu lỗi và chưa có dữ liệu. Hai hook trả `?? 0` lúc đó —
 * hiện số 0 ra là nói dối khách rằng họ hết Xu. Đang tải thì hiện skeleton.
 */
const NO_VALUE = '—'
/** Cùng cách che số của hai màn hub. */
const HIDDEN_VALUE = '••••••'
/** Icon mắt 16pt + hitSlop 14 mỗi phía = vùng chạm 44pt (Apple HIG). */
const EYE_HIT_SLOP = 14
const CARD_RADIUS = 16

type CardTheme = {
  /** Hai màu trùng nhau là nền đặc. */
  gradient: readonly [string, string]
  label: string
  text: string
  footerBg: string
  footerText: string
  /** Đường kẻ mảnh giữa thân và dải chân, khi dải chân cùng màu thân thẻ. */
  divider?: string
  skeleton: string
}

// Mọi màu đi từ design token. Thẻ Xu mang màu thương hiệu (primary); thẻ
// Điểm là thẻ trắng thường của app (`card`).
const COIN_THEME: Record<'light' | 'dark', CardTheme> = {
  light: {
    gradient: [colors.primary.light, colors.primary.dark],
    label: hexToRgba(colors.white.light, 0.9),
    text: colors.white.light,
    footerBg: hexToRgba(colors.foreground.light, 0.08),
    footerText: colors.white.light,
    skeleton: hexToRgba(colors.white.light, 0.35),
  },
  dark: {
    gradient: [colors.primary.dark, colors.primary.dark],
    label: hexToRgba(colors.white.light, 0.88),
    text: colors.white.light,
    footerBg: hexToRgba(colors.foreground.light, 0.16),
    footerText: colors.white.light,
    skeleton: hexToRgba(colors.white.light, 0.3),
  },
}

const POINTS_THEME: Record<'light' | 'dark', CardTheme> = {
  light: {
    gradient: [colors.card.light, colors.card.light],
    label: colors.mutedForeground.light,
    text: colors.foreground.light,
    // Dải chân cùng màu thân thẻ, ngăn bằng đường kẻ. Đừng dùng `background`:
    // đó là màu nền trang, nửa dưới thẻ sẽ tan vào nền.
    footerBg: colors.card.light,
    footerText: colors.primary.light,
    divider: colors.border.light,
    skeleton: colors.border.light,
  },
  dark: {
    gradient: [colors.card.dark, colors.card.dark],
    label: colors.mutedForeground.dark,
    text: colors.foreground.dark,
    footerBg: colors.card.dark,
    footerText: colors.primary.dark,
    divider: colors.border.dark,
    skeleton: colors.border.dark,
  },
}

/**
 * Khung chung của một thẻ: nền, thân, dải chân có `›`, và phản hồi thu nhỏ
 * khi chạm (MOTION.pressScale + SPRING_CONFIGS.press, chuẩn của repo).
 *
 * Dùng Pressable của RN chứ không NativeGesturePressable: thẻ Xu có nút mắt
 * lồng bên trong, và responder của RN cho Pressable trong cùng nhận cú chạm
 * — Tap của gesture handler ở thẻ cha sẽ bắt luôn cú chạm vào mắt.
 */
const BalanceTile = memo(function BalanceTile({
  theme,
  flex,
  onPress,
  footer,
  footerTestID,
  accessibilityLabel,
  children,
}: {
  theme: CardTheme
  flex: number
  onPress: () => void
  footer: string
  footerTestID?: string
  accessibilityLabel: string
  children: ReactNode
}) {
  // Shared value chỉ được đổi trong useEffect (cùng cách components/ui/
  // checkbox.tsx) — đổi nó trong useCallback vi phạm react-hooks/immutability.
  const [pressed, setPressed] = useState(false)
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(
      pressed ? MOTION.pressScale : 1,
      SPRING_CONFIGS.press,
    )
  }, [pressed, scale])
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  const onPressIn = useCallback(() => setPressed(true), [])
  const onPressOut = useCallback(() => setPressed(false), [])

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ flex }}
    >
      <Animated.View style={pressStyle}>
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: CARD_RADIUS, overflow: 'hidden' }}
        >
          <View className="px-4 pb-3 pt-3">{children}</View>
          <View
            testID={footerTestID}
            className="flex-row items-center justify-between px-4 py-3"
            style={{
              backgroundColor: theme.footerBg,
              borderTopWidth: theme.divider ? StyleSheet.hairlineWidth : 0,
              borderTopColor: theme.divider,
            }}
          >
            <Text
              className="font-sans-medium"
              style={{ fontSize: 14, color: theme.footerText }}
              numberOfLines={1}
            >
              {footer}
            </Text>
            <ChevronRight
              size={16}
              color={theme.footerText}
              strokeWidth={2.4}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  )
})

const CardLabel = memo(function CardLabel({
  children,
  color,
}: {
  children: string
  color: string
}) {
  return (
    <Text className="font-sans" style={{ fontSize: 12, color }}>
      {children}
    </Text>
  )
})

const CardNumber = memo(function CardNumber({
  value,
  unit,
  theme,
  loading,
}: {
  value: string
  unit?: string
  theme: CardTheme
  loading: boolean
}) {
  if (loading) {
    return (
      <Skeleton
        className="mt-1 h-7 w-24 rounded-xl"
        style={{ backgroundColor: theme.skeleton }}
      />
    )
  }
  return (
    <View className="mt-1 flex-row" style={{ alignItems: 'baseline' }}>
      <Text
        className="shrink font-sans-bold"
        style={{
          fontSize: 24,
          color: theme.text,
          // Chữ số cùng bề rộng: số dư đổi thì các chữ số không xô lệch nhau.
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
        // Số dư dài (hàng chục triệu) không được bị cắt "…" — một con số ví
        // bị cắt rất dễ đọc nhầm. Thu nhỏ chữ cho vừa thay vì cắt.
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {unit ? (
        <Text
          className="ml-1 font-sans-medium"
          style={{ fontSize: 14, color: theme.label }}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  )
})

const SignedInBalance = memo(function SignedInBalance({
  slug,
  isDark,
}: {
  slug: string
  isDark: boolean
}) {
  const { t } = useTranslation('home')
  const coin = useCoinBalance()
  const points = useLoyaltyPoints(slug)
  const refetchCoin = coin.refetch
  const refetchPoints = points.refetch
  const [coinHidden, setCoinHidden] = useState(false)

  // Làm mới mỗi lần quay lại Home: refetchOnWindowFocus đang tắt toàn cục và
  // tab Home không unmount, nên không có gì khác kéo số mới về sau khi khách
  // vừa trả bằng Xu ở quầy. Bỏ lần focus đầu — lúc đó query đang tự tải.
  const isFirstFocus = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false
        return
      }
      void refetchCoin()
      void refetchPoints()
    }, [refetchCoin, refetchPoints]),
  )

  const openCoins = useCallback(() => {
    navigateNative.push('/profile/coin-hub')
  }, [])
  const openPoints = useCallback(() => {
    navigateNative.push('/profile/loyalty-point-hub')
  }, [])
  const toggleCoinHidden = useCallback(() => {
    setCoinHidden((v) => !v)
  }, [])

  const scheme = isDark ? 'dark' : 'light'
  const coinTheme = COIN_THEME[scheme]
  const pointsTheme = POINTS_THEME[scheme]
  const coinLoading = !coin.hasData && coin.isLoading
  const pointsLoading = !points.hasData && points.isLoading
  const coinValue = !coin.hasData
    ? NO_VALUE
    : coinHidden
      ? HIDDEN_VALUE
      : formatPoints(coin.balance)
  const pointsValue = points.hasData
    ? formatPoints(points.totalPoints)
    : NO_VALUE
  const EyeIcon = coinHidden ? EyeOff : Eye

  return (
    <View className="mx-4 mt-3 flex-row gap-3">
      <BalanceTile
        theme={coinTheme}
        flex={1.55}
        onPress={openCoins}
        footer={t('balance.coinHistory')}
        accessibilityLabel={t('balance.coin')}
      >
        <View className="flex-row items-center gap-2">
          <CardLabel color={coinTheme.label}>{t('balance.coin')}</CardLabel>
          {/* Pressable lồng: chạm mắt không kéo theo điều hướng của thẻ. */}
          <Pressable
            onPress={toggleCoinHidden}
            hitSlop={EYE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={
              coinHidden ? t('balance.show') : t('balance.hide')
            }
          >
            <EyeIcon size={16} color={coinTheme.label} strokeWidth={2} />
          </Pressable>
        </View>
        <CardNumber
          value={coinValue}
          unit={coin.hasData && !coinHidden ? t('balance.coinUnit') : undefined}
          theme={coinTheme}
          loading={coinLoading}
        />
      </BalanceTile>

      <BalanceTile
        theme={pointsTheme}
        flex={1}
        onPress={openPoints}
        footer={t('balance.viewPoints')}
        footerTestID="balance-points-footer"
        accessibilityLabel={t('balance.points')}
      >
        <CardLabel color={pointsTheme.label}>{t('balance.points')}</CardLabel>
        <CardNumber
          value={pointsValue}
          theme={pointsTheme}
          loading={pointsLoading}
        />
      </BalanceTile>
    </View>
  )
})

const SignInPrompt = memo(function SignInPrompt({
  isDark,
}: {
  isDark: boolean
}) {
  const { t } = useTranslation('home')
  const openLogin = useCallback(() => {
    navigateNative.push('/auth/login')
  }, [])

  return (
    <View className="mx-4 mt-3 flex-row">
      <BalanceTile
        theme={COIN_THEME[isDark ? 'dark' : 'light']}
        flex={1}
        onPress={openLogin}
        footer={t('balance.loginAction')}
        accessibilityLabel={t('balance.loginCta')}
      >
        <Text
          className="font-sans-semibold"
          style={{ fontSize: 16, color: colors.white.light }}
        >
          {t('balance.loginCta')}
        </Text>
      </BalanceTile>
    </View>
  )
})

export const BalanceCard = memo(function BalanceCard() {
  const isDark = useColorScheme() === 'dark'
  const hasUser = useUserStore((s) => !!s.userInfo)
  const slug = useUserStore((s) => s.userInfo?.slug)

  return hasUser && slug ? (
    <SignedInBalance slug={slug} isDark={isDark} />
  ) : (
    <SignInPrompt isDark={isDark} />
  )
})
