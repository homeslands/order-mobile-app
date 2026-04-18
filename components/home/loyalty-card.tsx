/**
 * LoyaltyCard — hiển thị số xu và hạng thành viên trên màn Home.
 * Nếu chưa đăng nhập: CTA mời đăng nhập.
 */
import { Coins, ChevronRight, LogIn } from 'lucide-react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View, useColorScheme } from 'react-native'
import { useRouter } from 'expo-router'

import { Skeleton } from '@/components/ui'
import { colors } from '@/constants'
import { useCoinBalance } from '@/hooks'
import { useAuthStore } from '@/stores'

function formatPoints(n: number): string {
  return n.toLocaleString('vi-VN')
}

export const LoyaltyCard = React.memo(function LoyaltyCard() {
  const { t } = useTranslation('home')
  const isDark = useColorScheme() === 'dark'
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const { balance, isLoading } = useCoinBalance(isAuthenticated)

  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const primaryBg = isDark ? 'rgba(214,137,16,0.12)' : 'rgba(247,167,55,0.10)'
  const borderColor = isDark ? 'rgba(214,137,16,0.25)' : 'rgba(247,167,55,0.30)'

  const handlePress = () => {
    if (!isAuthenticated) {
      router.push('/(tabs)/profile' as never)
      return
    }
    router.push('/profile/loyalty-point-hub' as never)
  }

  return (
    <Pressable
      onPress={handlePress}
      className="mx-4 overflow-hidden rounded-2xl"
      style={{ backgroundColor: primaryBg, borderWidth: 1, borderColor }}
    >
      <View className="flex-row items-center gap-3 px-4 py-3">
        {/* Icon */}
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: primaryColor + '22' }}
        >
          <Coins size={20} color={primaryColor} />
        </View>

        {/* Content */}
        <View className="flex-1">
          {isAuthenticated ? (
            <>
              <Text className="text-xs text-muted-foreground">
                {t('loyaltyCard.balanceLabel')}
              </Text>
              {isLoading ? (
                <Skeleton className="mt-0.5 h-5 w-24 rounded-md" />
              ) : (
                <Text
                  className="text-base font-bold"
                  style={{ color: primaryColor }}
                >
                  {formatPoints(balance)} {t('loyaltyCard.coinUnit')}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text className="text-sm font-semibold text-foreground">
                {t('loyaltyCard.loginCta')}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                {t('loyaltyCard.loginSubtitle')}
              </Text>
            </>
          )}
        </View>

        {/* CTA */}
        {isAuthenticated ? (
          <ChevronRight size={18} color={primaryColor} />
        ) : (
          <View
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: primaryColor }}
          >
            <LogIn size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">
              {t('loyaltyCard.loginButton')}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  )
})
