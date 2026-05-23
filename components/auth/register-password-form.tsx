import { useState } from 'react'
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
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated'

import { AnimatedCountdownText } from './animated-countdown-text'
import { ChangePhoneConfirmSheet } from './change-phone-confirm-sheet'
import { RegisterProgressBar } from './register-progress-bar'
import { PasswordInputField } from '@/components/input/password-input-field'
import { PasswordRulesInput } from '@/components/input/password-rules-input'
import {
  useAnimatedCountdown,
  useCompleteRegistration,
  usePostAuthActions,
  useZodForm,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import {
  useRegisterPasswordSchema,
  type TRegisterPasswordSchema,
} from '@/schemas'
import { asyncStorage } from '@/utils/storage'
import { showErrorToastMessage, showToast } from '@/utils'
import { Text } from '@/components/ui/text'

interface RegisterPasswordFormProps {
  phone: string
  otp: string
  otpExpiresAt?: string
}

export default function RegisterPasswordForm({
  phone,
  otp,
  otpExpiresAt,
}: RegisterPasswordFormProps) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'
  const schema = useRegisterPasswordSchema()

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(schema, {
    defaultValues: { password: '', confirmPassword: '' },
  })

  const { mutateAsync: completeRegistration, isPending } =
    useCompleteRegistration()
  const { handleAuthSuccess } = usePostAuthActions()

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  // Track OTP expiry — client-side guard so user isn't surprised after filling password
  const [isOtpExpired, setIsOtpExpired] = useState(
    () =>
      otpExpiresAt != null && new Date(otpExpiresAt).getTime() <= Date.now(),
  )
  const otpExpiryShared = useAnimatedCountdown({
    expiresAt: otpExpiresAt,
    enabled: otpExpiresAt != null,
  })
  useAnimatedReaction(
    () => otpExpiryShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(setIsOtpExpired)(true)
      }
    },
  )

  const onSubmit = async (data: TRegisterPasswordSchema) => {
    // Guard: OTP may have expired while user was on this screen
    if (isOtpExpired) {
      showToast(t('register.otpExpiredResend'), 'warning')
      navigateNative.replace(
        `/auth/register/otp?phone=${encodeURIComponent(phone)}`,
      )
      return
    }
    const requestPayload = { phonenumber: phone, otp, password: data.password }
    try {
      const res = await completeRegistration(requestPayload)
      await handleAuthSuccess(res.result, () => {
        asyncStorage.removeItem(`register:otp:${phone}`)
        showToast(t('register.registerSuccess'), 'success')
        navigateNative.replace('/auth/register/profile')
      })
    } catch (err) {
      const apiErr = err as { response?: { data?: { statusCode?: number }; status?: number } }
      const serverCode = apiErr?.response?.data?.statusCode
      const status = apiErr?.response?.status
      if (serverCode === 119048) {
        showToast(t('register.otpExpiredResend'), 'warning')
        navigateNative.replace(
          `/auth/register/otp?phone=${encodeURIComponent(phone)}`,
        )
      } else if (status === 400 || status === 422) {
        showErrorToastMessage(t('register.otpInvalid'))
        navigateNative.replace(
          `/auth/register/otp?phone=${encodeURIComponent(phone)}`,
        )
      }
    }
  }

  const isLoading = isPending || isSubmitting || isOtpExpired

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 px-6 pt-12">
        <RegisterProgressBar step={3} />

        <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
          {t('register.setPasswordTitle')}
        </Text>
        <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
          {t('register.setPasswordSubtitle')}
        </Text>

        {otpExpiresAt != null && (
          <View className="mb-4">
            {isOtpExpired ? (
              <Text className="font-sans text-sm text-red-500 dark:text-red-400">
                {t('register.otpExpiredResend')}
              </Text>
            ) : (
              <AnimatedCountdownText
                countdownShared={otpExpiryShared}
                label={t('register.otpExpiresIn')}
                className="font-sans text-sm"
                isDark={isDark}
                warningThreshold={600}
              />
            )}
          </View>
        )}

        <View className="gap-4">
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                  error={errors.confirmPassword?.message}
                />
              )}
            />
          </View>

          <TouchableOpacity
            className="mt-2 items-center justify-center rounded-lg bg-primary py-4"
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-sans-semibold text-base text-white">
                {t('register.createAccount')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="py-2"
            onPress={() => {
              Keyboard.dismiss()
              setIsConfirmOpen(true)
            }}
            disabled={isLoading}
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
