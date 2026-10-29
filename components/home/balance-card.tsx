/**
 * BalanceCard — hai thẻ số dư trên Home, theo ngôn ngữ của ZaloPay.
 *
 * Đã đăng nhập: thẻ Xu (to, cam đậm, có nút ẩn số) và thẻ Điểm tích luỹ (nhỏ,
 * nâu cà phê). Mỗi thẻ có một dải chân với lời gọi hành động; chạm vào đâu
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
import { Pressable, View, useColorScheme } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { useCoinBalance, useLoyaltyPoints } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import { formatPoints } from '@/utils'

const ON_CARD = colors.white.light

/**
 * Hiện khi chưa có dữ liệu. Hai hook trả `?? 0` khi chưa tải xong hoặc khi lần
 * tải đầu lỗi — hiện số 0 đó ra là nói dối khách rằng họ hết Xu.
 */
const NO_VALUE = '—'
/** Cùng cách che số của hai màn hub. */
const HIDDEN_VALUE = '••••••'

const COIN_GRADIENT = {
  light: ['#ec9526', '#c46d09'],
  dark: ['#c47a12', '#8f5205'],
} as const
const POINTS_GRADIENT = {
  light: ['#8d6a4e', '#644732'],
  dark: ['#6b503b', '#47321f'],
} as const

/** Khung chung của một thẻ: nền gradient, thân, và dải chân có `›`. */
const GradientCard = memo(function GradientCard({
  gradient,
  flex,
  onPress,
  footer,
  children,
}: {
  gradient: readonly [string, string]
  flex: number
  onPress: () => void
  footer: string
  children: ReactNode
}) {
  return (
    <Pressable onPress={onPress} style={{ flex }}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 18, overflow: 'hidden' }}
      >
        <View className="px-3.5 pb-3 pt-3">{children}</View>
        <View
          className="flex-row items-center justify-between px-3.5 py-2.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
        >
          <Text
            className="font-semibold"
            style={{ fontSize: 12.5, color: ON_CARD }}
            numberOfLines={1}
          >
            {footer}
          </Text>
          <ChevronRight size={16} color={ON_CARD} strokeWidth={2.4} />
        </View>
      </LinearGradient>
    </Pressable>
  )
})

const CardLabel = memo(function CardLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 12.5, color: ON_CARD, opacity: 0.92 }}>
      {children}
    </Text>
  )
})

const CardNumber = memo(function CardNumber({
  value,
  unit,
}: {
  value: string
  unit?: string
}) {
  return (
    <View className="mt-1.5 flex-row" style={{ alignItems: 'baseline' }}>
      <Text
        className="shrink font-extrabold"
        style={{ fontSize: 22, color: ON_CARD, letterSpacing: -0.3 }}
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
          style={{ fontSize: 13, color: ON_CARD, opacity: 0.85 }}
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

  return (
    <View className="mx-4 mt-2.5 flex-row gap-2.5">
      <GradientCard
        gradient={COIN_GRADIENT[scheme]}
        flex={1.55}
        onPress={openCoins}
        footer={t('balance.coinHistory')}
      >
        <View className="flex-row items-center gap-1.5">
          <CardLabel>{t('balance.coin')}</CardLabel>
          {/* Pressable lồng: chạm mắt không kéo theo điều hướng của thẻ. */}
          <Pressable
            onPress={toggleCoinHidden}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              coinHidden ? t('balance.show') : t('balance.hide')
            }
          >
            <EyeIcon size={15} color={ON_CARD} strokeWidth={2} />
          </Pressable>
        </View>
        <CardNumber
          value={coinValue}
          unit={coin.hasData && !coinHidden ? t('balance.coinUnit') : undefined}
        />
      </GradientCard>

      <GradientCard
        gradient={POINTS_GRADIENT[scheme]}
        flex={1}
        onPress={openPoints}
        footer={t('balance.viewPoints')}
      >
        <CardLabel>{t('balance.points')}</CardLabel>
        <CardNumber value={pointsValue} />
        {/* Đồng xu trang trí — minh hoạ, không mang dữ liệu. */}
        <View
          pointerEvents="none"
          className="absolute right-2.5 top-2.5 rounded-full"
          style={{
            width: 30,
            height: 30,
            backgroundColor: '#f6c13d',
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.25)',
          }}
        />
      </GradientCard>
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
    <View className="mx-4 mt-2.5 flex-row">
      <GradientCard
        gradient={COIN_GRADIENT[isDark ? 'dark' : 'light']}
        flex={1}
        onPress={openLogin}
        footer={t('balance.loginAction')}
      >
        <Text
          className="font-semibold"
          style={{ fontSize: 15, color: ON_CARD, lineHeight: 21 }}
        >
          {t('balance.loginCta')}
        </Text>
      </GradientCard>
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
