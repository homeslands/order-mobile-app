import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { AnimatedCountdownText, OTPInput } from '@/components/auth'
import { Button } from '@/components/ui'
import { useAnimatedCountdown } from '@/hooks'

/**
 * Resend button countdown text — isolated so only this sub-component
 * re-renders every second via runOnJS, not the entire OTPStepForgot.
 */
const ResendCountdownLabel = React.memo(function ResendCountdownLabel({
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

  return (
    <Text className={className}>{`${label} (${displayTime})`}</Text>
  )
})

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

  // UI-thread countdown — no JS re-renders during tick
  const otpShared = useAnimatedCountdown({ expiresAt, enabled: true })

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
  const isResendDisabled = isResending || isVerifyingOTP || !isExpired

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeTranslateX?.value ?? 0 },
    ],
  }))

  return (
    <View className="gap-4">
      {maskedIdentity ? (
        <Text className="text-center text-sm font-sans text-gray-500 dark:text-gray-400">
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
          className="text-center text-sm font-sans"
        />
      ) : (
        <Text className="text-center text-sm font-sans text-red-500 dark:text-red-400">
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
          <Text className="text-sm font-sans-semibold text-white">
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
            <ActivityIndicator
              color={isExpired ? '#fff' : undefined}
            />
          ) : !isExpired ? (
            // Countdown text isolated — only ResendCountdownLabel re-renders per second
            <ResendCountdownLabel
              countdownShared={otpShared}
              label={t('forgotPassword.resend')}
              className="text-sm font-sans-semibold text-gray-500 dark:text-gray-400"
            />
          ) : (
            <Text className="text-sm font-sans-semibold text-white">
              {t('forgotPassword.resend')}
            </Text>
          )}
        </Button>

        <TouchableOpacity onPress={onBack} className="py-2">
          <Text className="text-center text-sm font-sans-medium text-amber-500 dark:text-amber-400">
            {t('forgotPassword.changeIdentity')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})
