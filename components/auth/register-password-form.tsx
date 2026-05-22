import { useState } from 'react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

import { ChangePhoneConfirmSheet } from './change-phone-confirm-sheet'
import { RegisterProgressBar } from './register-progress-bar'
import { PasswordInputField } from '@/components/input/password-input-field'
import { PasswordRulesInput } from '@/components/input/password-rules-input'
import {
  useCompleteRegistration,
  usePostAuthActions,
  useZodForm,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import {
  useRegisterPasswordSchema,
  type TRegisterPasswordSchema,
} from '@/schemas'
import { showErrorToastMessage, showToast } from '@/utils'

interface RegisterPasswordFormProps {
  phone: string
  otp: string
}

export default function RegisterPasswordForm({
  phone,
  otp,
}: RegisterPasswordFormProps) {
  const { t } = useTranslation('auth')
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

  const onSubmit = async (data: TRegisterPasswordSchema) => {
    try {
      const res = await completeRegistration({
        phonenumber: phone,
        otp,
        password: data.password,
      })
      await handleAuthSuccess(res.result, () => {
        showToast(t('register.registerSuccess'), 'success')
        navigateNative.replace('/auth/register/profile')
      })
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status
      if (status === 400 || status === 422) {
        showErrorToastMessage(t('register.otpInvalid'))
        navigateNative.replace(
          `/auth/register/otp?phone=${encodeURIComponent(phone)}`,
        )
      }
    }
  }

  const isLoading = isPending || isSubmitting

  return (
    <View className="flex-1 px-6 pt-12">
      <RegisterProgressBar step={3} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.setPasswordTitle')}
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.setPasswordSubtitle')}
      </Text>

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
          onPress={() => setIsConfirmOpen(true)}
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
  )
}
