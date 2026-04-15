import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { AnimatedCountdownText, OTPInput } from '@/components/auth'
import { Button } from '@/components/ui'
import {
  useAnimatedCountdown,
  useCountdown,
  useFormatTime,
} from '@/hooks'

export const OTPStepForgot = React.memo(function OTPStepForgot({
  expiresAt,
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

  const otpSeconds = useCountdown({ expiresAt, enabled: true })
  const otpTimeDisplay = useFormatTime(otpSeconds)
  const otpShared = useAnimatedCountdown({ expiresAt, enabled: true })
  const otpExpired = otpSeconds === 0

  useEffect(() => {
    if (otpExpired) onExpired()
  }, [otpExpired, onExpired])

  const isVerifyDisabled =
    otpValue.length !== 6 || isVerifyingOTP || otpExpired
  const isResendDisabled = isResending || isVerifyingOTP || otpSeconds > 0

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeTranslateX?.value ?? 0 },
    ],
  }))

  return (
    <View className="gap-4">
      {maskedIdentity ? (
        <Text className="text-center text-sm font-sans text-muted-foreground">
          {t('forgotPassword.otpSentTo', { identity: maskedIdentity })}
        </Text>
      ) : null}

      <Animated.View style={shakeStyle}>
        <OTPInput
          value={otpValue}
          onChange={onOtpChange}
          length={6}
          disabled={otpExpired}
        />
      </Animated.View>

      {!otpExpired ? (
        <AnimatedCountdownText
          countdownShared={otpShared}
          label={t('forgotPassword.otpExpiresIn')}
          className="text-center text-sm font-sans"
        />
      ) : (
        <Text className="text-center text-sm font-sans text-destructive">
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
          <Text className="text-sm font-sans-semibold text-primary-foreground">
            {t('forgotPassword.verify')}
          </Text>
        )}
      </Button>

      <View className="gap-2">
        <Button
          variant={otpExpired ? 'primary' : 'secondary'}
          className="h-11 rounded-lg"
          disabled={isResendDisabled}
          onPress={onResend}
        >
          {isResending ? (
            <ActivityIndicator
              color={otpExpired ? '#fff' : undefined}
            />
          ) : (
            <Text
              className={`text-sm font-sans-semibold ${
                isResendDisabled
                  ? 'text-muted-foreground'
                  : otpExpired
                    ? 'text-primary-foreground'
                    : 'text-foreground'
              }`}
            >
              {otpSeconds > 0
                ? `${t('forgotPassword.resend')} (${otpTimeDisplay})`
                : t('forgotPassword.resend')}
            </Text>
          )}
        </Button>

        <TouchableOpacity onPress={onBack} className="py-2">
          <Text className="text-center text-sm font-sans-medium text-primary">
            {t('forgotPassword.changeIdentity')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})
