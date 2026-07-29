import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'

import { FormInput } from '@/components/form/form-input'
import { PasswordInputField } from '@/components/input'
import { Text } from '@/components/ui/text'
import { ROUTE } from '@/constants'
import { useLogin, usePostAuthActions, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { loginSchema, TLoginSchema } from '@/schemas'
import type { ILoginResponse } from '@/types'
import { showErrorToastMessage } from '@/utils'

interface LoginFormProps {
  onLoginSuccess?: () => void
  onBeforeNavigate?: () => void
}

export default function LoginForm({
  onLoginSuccess,
  onBeforeNavigate,
}: LoginFormProps) {
  const { t } = useTranslation('auth')

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useZodForm(loginSchema, {
    defaultValues: { phonenumber: '', password: '' },
  })

  const { mutate: loginMutation, isPending } = useLogin()
  const { handleAuthSuccess } = usePostAuthActions()

  const onSubmit = (data: TLoginSchema) => {
    loginMutation(
      { phonenumber: data.phonenumber, password: data.password },
      {
        onSuccess: async (response: ILoginResponse) => {
          try {
            await handleAuthSuccess(response.result, onLoginSuccess)
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error'
            showErrorToastMessage(message)
          }
        },
        onError: () => {
          // Global error handler (QueryCache) sẽ show toast
        },
      },
    )
  }

  const isLoading = isPending || isSubmitting

  return (
    <View>
      <FormInput
        control={control}
        name="phonenumber"
        label={t('login.phoneNumber')}
        placeholder={t('login.enterPhoneNumber')}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoComplete="tel"
        textContentType="username"
        importantForAutofill="yes"
        disabled={isLoading}
        useTextInput
        transformOnChange={(v) => v.replace(/\D/g, '')}
        labelClassName="text-md font-sans-medium text-gray-500 dark:text-gray-400"
        containerClassName="mb-4"
      />

      <View>
        <Text className="mb-1 text-md font-sans-medium text-gray-500 dark:text-gray-400">
          {t('login.password')}
        </Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordInputField
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={t('login.enterPassword')}
              disabled={isLoading}
              error={errors.password?.message}
            />
          )}
        />
      </View>

      <TouchableOpacity
        className="mt-2 self-start"
        onPress={() => {
          onBeforeNavigate?.()
          navigateNative.push(ROUTE.FORGOT_PASSWORD)
        }}
        disabled={isLoading}
        hitSlop={8}
      >
        <Text className="font-sans-semibold text-sm text-primary">
          {t('login.forgotPassword')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-6 items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-white">
            {t('login.login')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}
