import { useCallback } from 'react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'

import { PasswordInputField, PasswordRulesInput } from '@/components/input'
import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { TResetPasswordSchema, useResetPasswordSchema } from '@/schemas'

interface ResetPasswordFormProps {
  onSubmit: (data: TResetPasswordSchema) => void
  isLoading?: boolean
  token: string
}

export function ResetPasswordForm({ onSubmit, isLoading = false, token }: ResetPasswordFormProps) {
  const { t } = useTranslation('auth')

  const schema = useResetPasswordSchema()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useZodForm(schema, {
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
      token: token,
    },
  })

  const onFormSubmit = useCallback((values: TResetPasswordSchema) => {
    onSubmit(values)
  }, [onSubmit])

  return (
    <View className="gap-4">
      {/* Mật khẩu mới */}
      <View>
        <Text className="mb-2 text-sm font-sans-medium text-gray-900 dark:text-white">
          {t('forgotPassword.newPassword')}
        </Text>
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordRulesInput
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={t('forgotPassword.enterNewPassword')}
              disabled={isLoading}
            />
          )}
        />
        {errors.newPassword && (
          <Text className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.newPassword.message}</Text>
        )}
      </View>

      {/* Xác nhận mật khẩu — PasswordInputField thay TextInput thuần */}
      <View>
        <Text className="mb-2 text-sm font-sans-medium text-gray-900 dark:text-white">
          {t('forgotPassword.confirmNewPassword')}
        </Text>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordInputField
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={t('forgotPassword.enterConfirmNewPassword')}
              disabled={isLoading}
              error={errors.confirmPassword?.message}
            />
          )}
        />
      </View>

      <Button variant="primary" className="mt-2 h-11 rounded-lg" disabled={isLoading} onPress={handleSubmit(onFormSubmit)}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-sm font-sans-semibold text-white">
            {t('forgotPassword.reset')}
          </Text>
        )}
      </Button>

      <Button variant="ghost" className="mt-2" disabled={isLoading} onPress={() => navigateNative.replace(ROUTE.LOGIN)}>
        <Text className="text-center text-sm font-sans-medium text-amber-500 dark:text-amber-400">
          {t('forgotPassword.backToLogin')}
        </Text>
      </Button>
    </View>
  )
}
