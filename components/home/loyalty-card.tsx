/**
 * LoyaltyCard — hiển thị số xu và hạng thành viên trên màn Home.
 * Nếu chưa đăng nhập: CTA mời đăng nhập.
 */
import { Coins, ChevronRight, LogIn } from 'lucide-react-native'
import React from 'react'
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
      className="mx-4 rounded-2xl overflow-hidden"
      style={{ backgroundColor: primaryBg, borderWidth: 1, borderColor }}
    >
      <View className="flex-row items-center px-4 py-3 gap-3">
        {/* Icon */}
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: primaryColor + '22' }}
        >
          <Coins size={20} color={primaryColor} />
        </View>

        {/* Content */}
        <View className="flex-1">
          {isAuthenticated ? (
            <>
              <Text className="text-xs text-muted-foreground">
                Điểm tích luỹ của bạn
              </Text>
              {isLoading ? (
                <Skeleton className="h-5 w-24 mt-0.5 rounded-md" />
              ) : (
                <Text
                  className="text-base font-bold"
                  style={{ color: primaryColor }}
                >
                  {formatPoints(balance)} xu
                </Text>
              )}
            </>
          ) : (
            <>
              <Text className="text-sm font-semibold text-foreground">
                Đăng nhập để tích điểm
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Nhận ưu đãi và quà tặng hấp dẫn
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
            <Text className="text-xs font-semibold text-white">Đăng nhập</Text>
          </View>
        )}
      </View>
    </Pressable>
  )
})
