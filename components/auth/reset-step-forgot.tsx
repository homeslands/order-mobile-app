import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, View, useColorScheme } from 'react-native'

import { AnimatedCountdownText } from '@/components/auth'
import { ResetPasswordForm } from '@/components/form'
import { Button } from '@/components/ui'
import { useAnimatedCountdown, useCountdown } from '@/hooks'
import { type TResetPasswordSchema } from '@/schemas'

export const ResetStepForgot = React.memo(function ResetStepForgot({
  token,
  expiresAt,
  isConfirming,
  onConfirm,
  onStartOver,
  onBackToLogin,
  onExpired,
}: {
  token: string
  expiresAt: string
  isConfirming: boolean
  onConfirm: (data: TResetPasswordSchema) => void
  onStartOver: () => void
  onBackToLogin: () => void
  onExpired: () => void
}) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'

  const tokenSeconds = useCountdown({ expiresAt, enabled: true })
  const tokenShared = useAnimatedCountdown({ expiresAt, enabled: true })
  const tokenExpired = tokenSeconds === 0

  useEffect(() => {
    if (tokenExpired) onExpired()
  }, [tokenExpired, onExpired])

  return (
    <View className="gap-4">
      {!tokenExpired && (
        <AnimatedCountdownText
          countdownShared={tokenShared}
          label={t('forgotPassword.sessionExpiresIn')}
          className="text-center font-sans text-sm"
          isDark={isDark}
        />
      )}

      {tokenExpired ? (
        <View className="gap-3">
          <Text className="text-center font-sans text-sm text-red-500 dark:text-red-400">
            {t('forgotPassword.sessionExpired')}
          </Text>
          <Button
            variant="primary"
            className="h-11 rounded-lg"
            onPress={onStartOver}
          >
            <Text className="font-sans-semibold text-sm text-white">
              {t('forgotPassword.sessionExpiredAction')}
            </Text>
          </Button>
          <TouchableOpacity onPress={onBackToLogin} className="py-2">
            <Text className="text-center font-sans-medium text-sm text-amber-500 dark:text-amber-400">
              {t('forgotPassword.backToLogin')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ResetPasswordForm
          token={token}
          onSubmit={onConfirm}
          isLoading={isConfirming}
        />
      )}
    </View>
  )
})
