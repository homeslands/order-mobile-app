import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, View } from 'react-native'

import { AnimatedCountdownText } from '@/components/auth'
import { ResetPasswordForm } from '@/components/form'
import { Button } from '@/components/ui'
import {
  useAnimatedCountdown,
  useCountdown,
} from '@/hooks'
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
          className="text-center text-sm font-sans"
        />
      )}

      {tokenExpired ? (
        <View className="gap-3">
          <Text className="text-center text-sm font-sans text-red-500 dark:text-red-400">
            {t('forgotPassword.sessionExpired')}
          </Text>
          <Button
            variant="primary"
            className="h-11 rounded-lg"
            onPress={onStartOver}
          >
            <Text className="text-sm font-sans-semibold text-white">
              {t('forgotPassword.sessionExpiredAction')}
            </Text>
          </Button>
          <TouchableOpacity onPress={onBackToLogin} className="py-2">
            <Text className="text-center text-sm font-sans-medium text-amber-500 dark:text-amber-400">
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
