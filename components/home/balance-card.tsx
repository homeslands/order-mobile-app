/**
 * BalanceCard — hai thẻ số dư trên Home, theo ngôn ngữ của ZaloPay.
 *
 * Đã đăng nhập: thẻ Xu (to, màu thương hiệu, có nút ẩn số) và thẻ Điểm tích
 * luỹ (nhỏ, thẻ trắng thường của app). Chỉ một mảng màu đậm trên Home — thẻ
 * bên cạnh dịu hẳn đi, như ZaloPay. Mỗi thẻ có một dải chân với lời gọi hành động; chạm vào đâu
 * trên thẻ cũng mở màn lịch sử của chính con số đó. Chưa đăng nhập: một thẻ
 * mời đăng nhập, không hiện số 0.
 *
 * "Đã đăng nhập" quyết bằng userInfo — cùng tín hiệu Profile dùng để chọn
 * LoginPanel — chứ KHÔNG bằng isAuthenticated(): hàm đó trả false suốt lúc
 * refresh token đang bay, nên thẻ sẽ nháy lời mời đăng nhập mỗi lần mở app
 * sau khi access token hết hạn.
 */
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronRight, Eye, EyeOff } from 'lucide-react-native'
import { memo, useCallback, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { useCoinBalance, useLoyaltyPoints } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { hexToRgba } from '@/lib/utils'
import { useUserStore } from '@/stores'
import { formatPoints } from '@/utils'

/**
 * Hiện khi chưa có dữ liệu. Hai hook trả `?? 0` khi chưa tải xong hoặc khi lần
 * tải đầu lỗi — hiện số 0 đó ra là nói dối khách rằng họ hết Xu.
 */
const NO_VALUE = '—'
/** Cùng cách che số của hai màn hub. */
const HIDDEN_VALUE = '••••••'

type CardTheme = {
  /** Hai màu trùng nhau là nền đặc. */
  gradient: readonly [string, string]
  label: string
  text: string
  footerBg: string
  footerText: string
  /** Đường kẻ mảnh giữa thân và dải chân, khi dải chân cùng màu thân thẻ. */
  divider?: string
}

// Mọi màu đi từ design token. Thẻ Xu mang màu thương hiệu (cam primary); thẻ
// Điểm là thẻ trắng bình thường của app (`card`) — chỉ một mảng đậm trên Home.
const COIN_THEME: Record<'light' | 'dark', CardTheme> = {
  light: {
    gradient: [colors.primary.light, colors.primary.dark],
    label: hexToRgba(colors.white.light, 0.9),
    text: colors.white.light,
    footerBg: hexToRgba(colors.foreground.light, 0.08),
    footerText: colors.white.light,
  },
  dark: {
    gradient: [colors.primary.dark, colors.primary.dark],
    label: hexToRgba(colors.white.light, 0.88),
    text: colors.white.light,
    footerBg: hexToRgba(colors.foreground.light, 0.16),
    footerText: colors.white.light,
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
  },
  dark: {
    gradient: [colors.card.dark, colors.card.dark],
    label: colors.mutedForeground.dark,
    text: colors.foreground.dark,
    footerBg: colors.card.dark,
    footerText: colors.primary.dark,
    divider: colors.border.dark,
  },
}

/** Khung chung của một thẻ: nền, thân, và dải chân có `›`. */
const BalanceTile = memo(function BalanceTile({
  theme,
  flex,
  onPress,
  footer,
  footerTestID,
  children,
}: {
  theme: CardTheme
  flex: number
  onPress: () => void
  footer: string
  footerTestID?: string
  children: ReactNode
}) {
  return (
    <Pressable onPress={onPress} style={{ flex }}>
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 18, overflow: 'hidden' }}
      >
        <View className="px-3.5 pb-3 pt-3">{children}</View>
        <View
          testID={footerTestID}
          className="flex-row items-center justify-between px-3.5 py-2.5"
          style={{
            backgroundColor: theme.footerBg,
            borderTopWidth: theme.divider ? StyleSheet.hairlineWidth : 0,
            borderTopColor: theme.divider,
          }}
        >
          <Text
            className="font-semibold"
            style={{ fontSize: 13, color: theme.footerText }}
            numberOfLines={1}
          >
            {footer}
          </Text>
          <ChevronRight size={16} color={theme.footerText} strokeWidth={2.4} />
        </View>
      </LinearGradient>
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
  return <Text style={{ fontSize: 12.5, color }}>{children}</Text>
})

const CardNumber = memo(function CardNumber({
  value,
  unit,
  color,
}: {
  value: string
  unit?: string
  color: string
}) {
  return (
    <View className="mt-1.5 flex-row" style={{ alignItems: 'baseline' }}>
      <Text
        className="shrink font-extrabold"
        style={{ fontSize: 23, color, letterSpacing: -0.4 }}
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
          className="ml-1 font-semibold"
          style={{ fontSize: 13, color, opacity: 0.85 }}
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
  const coinValue = !coin.hasData
    ? NO_VALUE
    : coinHidden
      ? HIDDEN_VALUE
      : formatPoints(coin.balance)
  const pointsValue = points.hasData
    ? formatPoints(points.totalPoints)
    : NO_VALUE
  const EyeIcon = coinHidden ? EyeOff : Eye

  const coinTheme = COIN_THEME[scheme]
  const pointsTheme = POINTS_THEME[scheme]

  return (
    <View className="mx-4 mt-3 flex-row gap-2.5">
      <BalanceTile
        theme={coinTheme}
        flex={1.55}
        onPress={openCoins}
        footer={t('balance.coinHistory')}
      >
        <View className="flex-row items-center gap-1.5">
          <CardLabel color={coinTheme.label}>{t('balance.coin')}</CardLabel>
          {/* Pressable lồng: chạm mắt không kéo theo điều hướng của thẻ. */}
          <Pressable
            onPress={toggleCoinHidden}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              coinHidden ? t('balance.show') : t('balance.hide')
            }
          >
            <EyeIcon size={15} color={coinTheme.label} strokeWidth={2} />
          </Pressable>
        </View>
        <CardNumber
          value={coinValue}
          unit={coin.hasData && !coinHidden ? t('balance.coinUnit') : undefined}
          color={coinTheme.text}
        />
      </BalanceTile>

      <BalanceTile
        theme={pointsTheme}
        flex={1}
        onPress={openPoints}
        footer={t('balance.viewPoints')}
        footerTestID="balance-points-footer"
      >
        <CardLabel color={pointsTheme.label}>{t('balance.points')}</CardLabel>
        <CardNumber value={pointsValue} color={pointsTheme.text} />
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
      >
        <Text
          className="font-semibold"
          style={{ fontSize: 15, color: colors.white.light, lineHeight: 21 }}
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
