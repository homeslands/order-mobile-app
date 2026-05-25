import React, { memo, useCallback, useEffect, useState } from 'react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Keyboard,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { AnimatedCountdownText } from './animated-countdown-text'
import { ChangePhoneConfirmSheet } from './change-phone-confirm-sheet'
import { OTPInput } from './otp-input'
import { RegisterProgressBar } from './register-progress-bar'
import { PasswordInputField } from '@/components/input/password-input-field'
import { PasswordRulesInput } from '@/components/input/password-rules-input'
import { Button } from '@/components/ui'
import {
  useAnimatedCountdown,
  useCompleteRegistration,
  usePostAuthActions,
  useResendRegistration,
  useShakeAnimation,
  useZodForm,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import {
  useRegisterPasswordSchema,
  type TRegisterPasswordSchema,
} from '@/schemas'
import { asyncStorage, setSyncItem } from '@/utils/storage'
import { showErrorToastMessage, showToast } from '@/utils'
import { Text } from '@/components/ui/text'

const ANIM_DURATION = 250
const PASSWORD_SECTION_MAX_HEIGHT = 700

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

export default function RegisterOtpPasswordStep({
  phone,
  serverOtpExpiresAt,
}: {
  phone: string
  serverOtpExpiresAt?: string
}) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'

  // ── OTP state ────────────────────────────────────────────────────────────
  const [otpValue, setOtpValue] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState(
    () =>
      serverOtpExpiresAt ?? new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  )
  const [resendAvailableAt, setResendAvailableAt] = useState(() =>
    new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  )
  const [isOtpExpired, setIsOtpExpired] = useState(
    () => new Date(otpExpiresAt).getTime() <= Date.now(),
  )
  const [isResendAvailable, setIsResendAvailable] = useState(
    () => new Date(resendAvailableAt).getTime() <= Date.now(),
  )

  const otpExpiryShared = useAnimatedCountdown({ expiresAt: otpExpiresAt })
  const resendCooldownShared = useAnimatedCountdown({
    expiresAt: resendAvailableAt,
  })

  useAnimatedReaction(
    () => otpExpiryShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(setIsOtpExpired)(true)
      }
    },
  )
  useAnimatedReaction(
    () => resendCooldownShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(setIsResendAvailable)(true)
      }
    },
  )

  const { mutate: resend, isPending: isResending } = useResendRegistration()
  const { translateX } = useShakeAnimation()

  // ── Password form ─────────────────────────────────────────────────────────
  const schema = useRegisterPasswordSchema()
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(schema, { defaultValues: { password: '', confirmPassword: '' } })

  const { mutateAsync: completeRegistration, isPending } =
    useCompleteRegistration()
  const { handleAuthSuccess } = usePostAuthActions()

  // ── Password section reveal animation ────────────────────────────────────
  const progress = useSharedValue(0)
  const passwordSectionVisible = otpValue.length === 6 && !isOtpExpired

  useEffect(() => {
    progress.value = withTiming(passwordSectionVisible ? 1 : 0, {
      duration: ANIM_DURATION,
    })
  }, [passwordSectionVisible, progress])

  const passwordSectionStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(
      progress.value,
      [0, 1],
      [0, PASSWORD_SECTION_MAX_HEIGHT],
    ),
    opacity: progress.value,
    overflow: 'hidden' as const,
  }))

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = useCallback(() => {
    resend(phone, {
      onSuccess: (res) => {
        const newExpiresAt =
          res.result?.expiresAt ??
          new Date(Date.now() + 10 * 60 * 1000).toISOString()
        setOtpExpiresAt(newExpiresAt)
        setSyncItem(`register:otp:${phone}`, newExpiresAt)
        setIsOtpExpired(false)
        setResendAvailableAt(
          new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        )
        setIsResendAvailable(false)
        setOtpValue('')
        showToast(t('register.otpResent'), 'success')
      },
      onError: () => {
        showToast(t('register.otpResendFailed'), 'error')
      },
    })
  }, [phone, resend, t])

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: TRegisterPasswordSchema) => {
    if (isOtpExpired) {
      showToast(t('register.otpExpiredResend'), 'warning')
      setOtpValue('')
      return
    }
    Keyboard.dismiss()
    try {
      const res = await completeRegistration({
        phonenumber: phone,
        otp: otpValue,
        password: data.password,
      })
      await handleAuthSuccess(res.result, () => {
        asyncStorage.removeItem(`register:otp:${phone}`)
        showToast(t('register.registerSuccess'), 'success')
        navigateNative.replace('/auth/register/profile')
      })
    } catch (err) {
      const apiErr = err as {
        response?: { data?: { statusCode?: number }; status?: number }
      }
      const serverCode = apiErr?.response?.data?.statusCode
      const status = apiErr?.response?.status
      if (serverCode === 119048) {
        showToast(t('register.otpExpiredResend'), 'warning')
        setOtpValue('')
      } else if (status === 400 || status === 422) {
        showErrorToastMessage(t('register.otpInvalid'))
        setOtpValue('')
      } else {
        showToast(t('register.profileUpdateFailed'), 'warning')
      }
    }
  }

  // ── Sheet / back ──────────────────────────────────────────────────────────
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleBackPress = useCallback(() => {
    if (otpValue.length > 0) {
      setIsConfirmOpen(true)
    } else {
      navigateNative.back()
    }
  }, [otpValue])

  const canResend = isResendAvailable || isOtpExpired
  const isResendDisabled = !canResend || isResending
  const isSubmitDisabled =
    !passwordSectionVisible || isPending || isSubmitting || isOtpExpired

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 px-6 pt-12">
        <RegisterProgressBar step={2} />

        <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
          {t('register.otpTitle')}
        </Text>
        <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
          {t('register.otpSentTo', { phone })}
        </Text>

        <View className="gap-4">
          {/* OTP input */}
          <Animated.View style={shakeStyle}>
            <OTPInput
              value={otpValue}
              onChange={setOtpValue}
              length={6}
              disabled={isOtpExpired || isResending}
              characterSet="alphanumeric"
            />
          </Animated.View>

          {/* Countdown + resend row */}
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

          {/* Password section — animated reveal when OTP complete */}
          <Animated.View style={passwordSectionStyle}>
            <View className="gap-4 pt-2">
              <View>
                <Text className="mb-2 font-sans-medium text-sm text-gray-500 dark:text-gray-400">
                  {t('register.password')}
                </Text>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <PasswordRulesInput
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      placeholder={t('register.enterPassword')}
                      disabled={isSubmitDisabled && !passwordSectionVisible}
                    />
                  )}
                />
              </View>

              <View>
                <Text className="mb-2 font-sans-medium text-sm text-gray-500 dark:text-gray-400">
                  {t('register.confirmPassword')}
                </Text>
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <PasswordInputField
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      placeholder={t('register.enterConfirmPassword')}
                      disabled={isSubmitDisabled && !passwordSectionVisible}
                      error={errors.confirmPassword?.message}
                    />
                  )}
                />
              </View>
            </View>
          </Animated.View>

          {/* Submit */}
          <Button
            variant="primary"
            className="mt-2 h-11 rounded-lg"
            disabled={isSubmitDisabled}
            onPress={handleSubmit(onSubmit)}
          >
            {isPending || isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-sans-semibold text-sm text-white">
                {t('register.createAccount')}
              </Text>
            )}
          </Button>

          {/* Change phone */}
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
    </TouchableWithoutFeedback>
  )
}
