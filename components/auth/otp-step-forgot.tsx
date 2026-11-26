import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { AnimatedCountdownText } from './animated-countdown-text'
import { OTPInput } from './otp-input'
import { Button } from '@/components/ui'
import { useAnimatedCountdown, useCountdown } from '@/hooks'
import { Text } from '@/components/ui/text'

export const OTPStepForgot = React.memo(function OTPStepForgot({
  expiresAt,
  resendAvailableAt,
  otpValue,
  onOtpChange,
  isResending,
  isVerifyingOTP,
  onVerify,
  onResend,
  onBack,
  onExpired,
  maskedIdentity,
  shakeTranslateX,
}: {
  expiresAt: string
  resendAvailableAt: string
  otpValue: string
  onOtpChange: (v: string) => void
  isResending: boolean
  isVerifyingOTP: boolean
  onVerify: () => void
  onResend: () => void
  onBack: () => void
  onExpired: () => void
  maskedIdentity?: string
  shakeTranslateX?: SharedValue<number>
}) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'

  // UI-thread countdown — no JS re-renders during tick
  const otpShared = useAnimatedCountdown({ expiresAt, enabled: true })
  // Cooldown gửi lại (60s) tách khỏi thời hạn OTP
  const resendSeconds = useCountdown({ expiresAt: resendAvailableAt })

  // JS-thread expired state — updated once when countdown hits 0
  const [isExpired, setIsExpired] = useState(() => {
    if (!expiresAt) return true
    return new Date(expiresAt).getTime() <= Date.now()
  })
  const [prevExpiresAt, setPrevExpiresAt] = useState(expiresAt)

  // Sync isExpired when expiresAt changes (new OTP sent via resend).
  // "setState during render" pattern — avoids useEffect+setState cascade.
  // New expiresAt from resend is always in the future; extreme clock skew
  // is handled immediately by useAnimatedReaction firing handleExpired.
  if (prevExpiresAt !== expiresAt) {
    setPrevExpiresAt(expiresAt)
    setIsExpired(false)
  }

  // Bridge expiry from UI thread → JS (fires once per OTP lifecycle)
  const handleExpired = useCallback(() => {
    setIsExpired(true)
    onExpired()
  }, [onExpired])

  useAnimatedReaction(
    () => otpShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(handleExpired)()
      }
    },
  )

  const isVerifyDisabled = otpValue.length !== 6 || isVerifyingOTP || isExpired
  const isResendDisabled = isResending || isVerifyingOTP || resendSeconds > 0

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeTranslateX?.value ?? 0 }],
  }))

  return (
    <View className="gap-4">
      {maskedIdentity ? (
        <Text className="text-center font-sans text-sm text-gray-500 dark:text-gray-400">
          {t('forgotPassword.otpSentTo', { identity: maskedIdentity })}
        </Text>
      ) : null}

      <Animated.View style={shakeStyle}>
        <OTPInput
          value={otpValue}
          onChange={onOtpChange}
          length={6}
          disabled={isExpired}
        />
      </Animated.View>

      {!isExpired ? (
        <AnimatedCountdownText
          countdownShared={otpShared}
          label={t('forgotPassword.otpExpiresIn')}
          className="text-center font-sans text-sm"
          isDark={isDark}
        />
      ) : (
        <Text className="text-center font-sans text-sm text-red-500 dark:text-red-400">
          {t('forgotPassword.otpExpired')}
        </Text>
      )}

      <Button
        variant="primary"
        className="mt-2 h-11 rounded-lg"
        disabled={isVerifyDisabled}
        onPress={onVerify}
      >
        {isVerifyingOTP ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-sm text-white">
            {t('forgotPassword.verify')}
          </Text>
        )}
      </Button>

      <View className="gap-2">
        <Button
          variant={isExpired ? 'primary' : 'secondary'}
          className="h-11 rounded-lg"
          disabled={isResendDisabled}
          onPress={onResend}
        >
          {isResending ? (
            <ActivityIndicator color={isExpired ? '#fff' : undefined} />
          ) : resendSeconds > 0 ? (
            <Text className="font-sans-semibold text-sm text-gray-500 dark:text-gray-400">
              {t('forgotPassword.resendAfter', { seconds: resendSeconds })}
            </Text>
          ) : (
            <Text
              className={`font-sans-semibold text-sm ${
                isExpired ? 'text-white' : 'text-foreground'
              }`}
            >
              {t('forgotPassword.resend')}
            </Text>
          )}
        </Button>

        <TouchableOpacity onPress={onBack} className="py-2">
          <Text className="text-center font-sans-medium text-sm text-amber-500 dark:text-amber-400">
            {t('forgotPassword.changeIdentity')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})
