import React, { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { AnimatedCountdownText } from './animated-countdown-text'
import { OTPInput } from './otp-input'
import { RegisterProgressBar } from './register-progress-bar'
import { Button } from '@/components/ui'
import {
  useAnimatedCountdown,
  useResendRegistration,
  useShakeAnimation,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'

/**
 * Resend button countdown label — isolated so only this sub-component
 * re-renders every second via runOnJS, not the entire RegisterOtpStep.
 */
const ResendCountdownLabel = memo(function ResendCountdownLabel({
  countdownShared,
  label,
  className,
}: {
  countdownShared: SharedValue<number>
  label: string
  className: string
}) {
  const [displayTime, setDisplayTime] = useState(() => {
    const s = Math.max(0, Math.floor(countdownShared.value))
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  })

  useAnimatedReaction(
    () => Math.floor(countdownShared.value),
    (current) => {
      if (current > 0) {
        const m = Math.floor(current / 60)
        const s = current % 60
        runOnJS(setDisplayTime)(`${m}:${String(s).padStart(2, '0')}`)
      }
    },
  )

  return <Text className={className}>{`${label} (${displayTime})`}</Text>
})

export default function RegisterOtpStep({ phone }: { phone: string }) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'

  // OTP expires in 10 minutes from mount — stored in useState so it never changes
  const [otpExpiresAt] = useState(
    () => new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  )

  // Resend cooldown: 2 minutes, resets after each successful resend
  const [resendAvailableAt, setResendAvailableAt] = useState(
    () => new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  )

  // UI thread countdown shared values — no JS re-renders during tick
  const otpExpiryShared = useAnimatedCountdown({ expiresAt: otpExpiresAt })
  const resendCooldownShared = useAnimatedCountdown({
    expiresAt: resendAvailableAt,
  })

  // JS-thread states updated once when countdowns hit 0
  const [isOtpExpired, setIsOtpExpired] = useState(false)
  const [isResendAvailable, setIsResendAvailable] = useState(false)

  const [otpValue, setOtpValue] = useState('')

  const { mutate: resend, isPending: isResending } = useResendRegistration()

  const { translateX, shake } = useShakeAnimation()

  // Bridge OTP expiry from UI thread → JS (fires once)
  useAnimatedReaction(
    () => otpExpiryShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(setIsOtpExpired)(true)
      }
    },
  )

  // Bridge resend cooldown from UI thread → JS (fires on each cooldown end)
  useAnimatedReaction(
    () => resendCooldownShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(setIsResendAvailable)(true)
      }
    },
  )

  const handleVerify = useCallback(() => {
    if (otpValue.length < 6 || isOtpExpired) {
      shake()
      return
    }
    navigateNative.push(
      `/auth/register/password?phone=${encodeURIComponent(phone)}&otp=${encodeURIComponent(otpValue)}`,
    )
  }, [otpValue, isOtpExpired, phone, shake])

  const handleResend = useCallback(() => {
    resend(phone, {
      onSuccess: () => {
        setResendAvailableAt(
          new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        )
        setIsResendAvailable(false)
        setOtpValue('')
      },
    })
  }, [phone, resend])

  const isVerifyDisabled = otpValue.length < 6 || isResending || isOtpExpired
  // Resend available when cooldown done OR OTP expired (need to get new OTP)
  const canResend = isResendAvailable || isOtpExpired
  const isResendDisabled = !canResend || isResending

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View className="flex-1 px-6 pt-12">
      <RegisterProgressBar step={2} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.otpTitle')}
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.otpSentTo', { phone })}
      </Text>

      <View className="gap-4">
        <Animated.View style={shakeStyle}>
          <OTPInput
            value={otpValue}
            onChange={setOtpValue}
            length={6}
            disabled={isOtpExpired || isResending}
            characterSet="alphanumeric"
          />
        </Animated.View>

        {!isOtpExpired ? (
          <AnimatedCountdownText
            countdownShared={otpExpiryShared}
            label={t('register.otpExpiresIn')}
            className="text-center font-sans text-sm"
            isDark={isDark}
          />
        ) : (
          <Text className="text-center font-sans text-sm text-red-500 dark:text-red-400">
            {t('register.otpExpired')}
          </Text>
        )}

        <Button
          variant="primary"
          className="mt-2 h-11 rounded-lg"
          disabled={isVerifyDisabled}
          onPress={handleVerify}
        >
          {isResending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-sans-semibold text-sm text-white">
              {t('register.verify')}
            </Text>
          )}
        </Button>

        <Button
          variant={canResend ? 'primary' : 'secondary'}
          className="h-11 rounded-lg"
          disabled={isResendDisabled}
          onPress={handleResend}
        >
          {isResending ? (
            <ActivityIndicator color={canResend ? '#fff' : undefined} />
          ) : !canResend ? (
            // Cooldown active — isolated sub-component so only it re-renders per second
            <ResendCountdownLabel
              countdownShared={resendCooldownShared}
              label={t('register.resend')}
              className="font-sans-semibold text-sm text-gray-500 dark:text-gray-400"
            />
          ) : (
            <Text className="font-sans-semibold text-sm text-white">
              {t('register.resend')}
            </Text>
          )}
        </Button>

        <TouchableOpacity
          className="py-2"
          onPress={() => navigateNative.back()}
          disabled={isResending}
        >
          <Text className="text-center font-sans-medium text-sm text-amber-500 dark:text-amber-400">
            {t('register.changePhone')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
