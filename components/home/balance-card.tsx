/**
 * BalanceCard — thẻ số dư Xu và Điểm tích luỹ trên Home.
 *
 * Đã đăng nhập: hai nửa, mỗi nửa chạm vào mở màn lịch sử của chính con số đó
 * (Xu → coin-hub, Điểm → loyalty-point-hub). Chưa đăng nhập: một dòng mời
 * đăng nhập, không hiện số 0.
 *
 * "Đã đăng nhập" quyết bằng userInfo — cùng tín hiệu Profile dùng để chọn
 * LoginPanel — chứ KHÔNG bằng isAuthenticated(): hàm đó trả false suốt lúc
 * refresh token đang bay, nên thẻ sẽ nháy dòng mời đăng nhập mỗi lần mở app
 * sau khi access token hết hạn.
 */
import { ChevronRight } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, useColorScheme } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { useCoinBalance, useLoyaltyPoints } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import { formatPoints } from '@/utils'

const ON_PRIMARY = colors.white.light

const BalanceHalf = memo(function BalanceHalf({
  label,
  value,
  onPress,
}: {
  label: string
  value: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-xs" style={{ color: ON_PRIMARY, opacity: 0.9 }}>
          {label}
        </Text>
        <Text
          className="text-lg font-bold"
          style={{ color: ON_PRIMARY }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      <ChevronRight size={16} color={ON_PRIMARY} />
    </Pressable>
  )
})

const SignedInBalance = memo(function SignedInBalance({
  slug,
}: {
  slug: string
}) {
  const { t } = useTranslation('home')
  const { balance } = useCoinBalance()
  const { totalPoints } = useLoyaltyPoints(slug)

  const openCoins = useCallback(() => {
    navigateNative.push('/profile/coin-hub')
  }, [])
  const openPoints = useCallback(() => {
    navigateNative.push('/profile/loyalty-point-hub')
  }, [])

  return (
    <>
      <BalanceHalf
        label={t('balance.coin')}
        value={formatPoints(balance)}
        onPress={openCoins}
      />
      <View
        className="my-3 w-px"
        style={{ backgroundColor: ON_PRIMARY, opacity: 0.25 }}
      />
      <BalanceHalf
        label={t('balance.points')}
        value={formatPoints(totalPoints)}
        onPress={openPoints}
      />
    </>
  )
})

const SignInPrompt = memo(function SignInPrompt() {
  const { t } = useTranslation('home')
  const openLogin = useCallback(() => {
    navigateNative.push('/auth/login')
  }, [])

  return (
    <Pressable
      onPress={openLogin}
      className="flex-1 flex-row items-center px-4 py-4"
    >
      <Text
        className="flex-1 text-sm font-semibold"
        style={{ color: ON_PRIMARY }}
      >
        {t('balance.loginCta')}
      </Text>
      <ChevronRight size={16} color={ON_PRIMARY} />
    </Pressable>
  )
})

export const BalanceCard = memo(function BalanceCard() {
  const isDark = useColorScheme() === 'dark'
  const hasUser = useUserStore((s) => !!s.userInfo)
  const slug = useUserStore((s) => s.userInfo?.slug)
  const background = isDark ? colors.primary.dark : colors.primary.light

  return (
    <View
      className="mx-4 mt-3 flex-row overflow-hidden rounded-2xl"
      style={{ backgroundColor: background }}
    >
      {hasUser && slug ? <SignedInBalance slug={slug} /> : <SignInPrompt />}
    </View>
  )
})
