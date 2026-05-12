import { useRouter } from 'expo-router'
import { Cake } from 'lucide-react-native'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, View } from 'react-native'

import { useUserStore } from '@/stores'

export const DobNudgeBanner = memo(function DobNudgeBanner() {
  const userInfo = useUserStore((s) => s.userInfo)
  const router = useRouter()
  const { t } = useTranslation('profile')

  if (!userInfo || userInfo.dob) return null

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/profile/edit')}
      activeOpacity={0.8}
      className="mx-4 mb-3 flex-row items-center gap-3 rounded-[18px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30"
    >
      <View className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/50">
        <Cake size={20} color="#f59e0b" />
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold text-sm text-gray-900 dark:text-white">
          {t('profile.dobNudge.title')}
        </Text>
        <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">
          {t('profile.dobNudge.subtitle')}
        </Text>
      </View>
      <Text className="font-sans-semibold text-xs text-amber-600 dark:text-amber-400">
        {t('profile.dobNudge.cta')}
      </Text>
    </TouchableOpacity>
  )
})
