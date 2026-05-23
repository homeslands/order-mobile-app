import React, { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
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
import { ChangePhoneConfirmSheet } from './change-phone-confirm-sheet'
import { OTPInput } from './otp-input'
import { RegisterProgressBar } from './register-progress-bar'
import { Button } from '@/components/ui'
import {
  useAnimatedCountdown,
  useResendRegistration,
  useShakeAnimation,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { setSyncItem } from '@/utils/storage'
import { showToast } from '@/utils'
import { Text } from '@/components/ui/text'

/**
 * Resend button countdown label — isolated so only this sub-component
 * re-renders every second via runOnJS, not the entire RegisterOtpStep.
 *
 * Receives `expiresAt` (ISO string) to compute the initial display directly,
 * avoiding a "0:00" flash caused by reading countdownShared before
 * useAnimatedCountdown's effect fires with the new expiresAt.
 */
const ResendCountdownLabel = memo(function ResendCountdownLabel({
  countdownShared,
  expiresAt,
  label,
  className,
}: {
  countdownShared: SharedValue<number>
  expiresAt: string
  label: string
  className: string
}) {
  const [displayTime, setDisplayTime] = useState(() => {
    const s = Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
    )
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

export default function RegisterOtpStep({
  phone,
  serverOtpExpiresAt,
}: {
  phone: string
  serverOtpExpiresAt?: string
}) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'

  // OTP expires — use server-provided time when available, fallback to +10min
  const [otpExpiresAt, setOtpExpiresAt] = useState(
    () =>
      serverOtpExpiresAt ?? new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  )

  // Resend cooldown: 2 minutes, resets after each successful resend
  const [resendAvailableAt, setResendAvailableAt] = useState(() =>
    new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  )

  // UI thread countdown shared values — no JS re-renders during tick
  const otpExpiryShared = useAnimatedCountdown({ expiresAt: otpExpiresAt })
  const resendCooldownShared = useAnimatedCountdown({
    expiresAt: resendAvailableAt,
  })

  // JS-thread states — derived from timestamp on mount so edge cases
  // (e.g. navigating back to an OTP screen with a stale expiresAt) are handled.
  const [isOtpExpired, setIsOtpExpired] = useState(
    () => new Date(otpExpiresAt).getTime() <= Date.now(),
  )
  const [isResendAvailable, setIsResendAvailable] = useState(
    () => new Date(resendAvailableAt).getTime() <= Date.now(),
  )

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
      `/auth/register/password?phone=${encodeURIComponent(phone)}&otp=${encodeURIComponent(otpValue)}&expiresAt=${encodeURIComponent(otpExpiresAt)}`,
    )
  }, [otpValue, isOtpExpired, phone, shake])

  const handleResend = useCallback(() => {
    console.log('[resendRegistration] REQUEST:', phone)
    resend(phone, {
      onSuccess: (res) => {
        console.log(
          '[resendRegistration] RESPONSE:',
          JSON.stringify(res, null, 2),
        )
        // Use server-provided expiry time for accuracy, persist for 119046 recovery
        const newExpiresAt =
          res.result?.expiresAt ??
          new Date(Date.now() + 10 * 60 * 1000).toISOString()
        setOtpExpiresAt(newExpiresAt)
        setSyncItem(`register:otp:${phone}`, newExpiresAt)
        setIsOtpExpired(false)
        // Reset resend cooldown
        setResendAvailableAt(new Date(Date.now() + 2 * 60 * 1000).toISOString())
        setIsResendAvailable(false)
        setOtpValue('')
        showToast(t('register.otpResent'), 'success')
      },
      onError: (err) => {
        console.log(
          '[resendRegistration] ERROR status:',
          (err as any)?.response?.status,
        )
        console.log(
          '[resendRegistration] ERROR data:',
          JSON.stringify((err as any)?.response?.data, null, 2),
        )
        showToast(t('register.otpResendFailed'), 'error')
      },
    })
  }, [phone, resend, t])

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleBackPress = useCallback(() => {
    if (otpValue.length > 0) {
      setIsConfirmOpen(true)
    } else {
      navigateNative.back()
    }
  }, [otpValue])

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

        <View className="flex-row items-center justify-between">
          {!isOtpExpired ? (
            <AnimatedCountdownText
              countdownShared={otpExpiryShared}
              label={t('register.otpExpiresIn')}
              className="font-sans text-sm"
              isDark={isDark}
            />
          ) : (
            <Text className="font-sans text-sm text-red-500 dark:text-red-400">
              {t('register.otpExpired')}
            </Text>
          )}

          <TouchableOpacity
            disabled={isResendDisabled}
            onPress={handleResend}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : !canResend ? (
              // Cooldown active — isolated sub-component so only it re-renders per second
              <ResendCountdownLabel
                countdownShared={resendCooldownShared}
                expiresAt={resendAvailableAt}
                label={t('register.resend')}
                className="font-sans-semibold text-sm text-gray-400 dark:text-gray-500"
              />
            ) : (
              <Text className="font-sans-semibold text-sm text-amber-500 dark:text-amber-400">
                {t('register.resend')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

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

        <TouchableOpacity
          className="py-2"
          onPress={handleBackPress}
          disabled={isResending}
        >
          <Text className="text-center font-sans-medium text-sm text-amber-500 dark:text-amber-400">
            {t('register.changePhone')}
          </Text>
        </TouchableOpacity>
      </View>

      <ChangePhoneConfirmSheet
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={() => navigateNative.replace('/auth/register')}
      />
    </View>
  )
}
