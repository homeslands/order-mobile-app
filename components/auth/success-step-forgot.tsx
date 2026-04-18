import { CircleCheck } from 'lucide-react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View, useColorScheme } from 'react-native'

import { Button } from '@/components/ui'
import { colors } from '@/constants'

export const SuccessStepForgot = React.memo(function SuccessStepForgot({
  onGoToLogin,
}: {
  onGoToLogin: () => void
}) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'

  const iconColor = isDark ? colors.primary.dark : colors.primary.light

  return (
    <View className="items-center gap-6 pt-8">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <CircleCheck size={40} color={iconColor} />
      </View>

      <View className="gap-2">
        <Text className="text-center font-sans-bold text-xl text-gray-900 dark:text-white">
          {t('forgotPassword.successTitle')}
        </Text>
        <Text className="text-center font-sans text-sm text-gray-500 dark:text-gray-400">
          {t('forgotPassword.successDescription')}
        </Text>
      </View>

      <Button
        variant="primary"
        className="h-11 w-full rounded-lg"
        onPress={onGoToLogin}
      >
        <Text className="font-sans-semibold text-sm text-white">
          {t('forgotPassword.successAction')}
        </Text>
      </Button>
    </View>
  )
})
