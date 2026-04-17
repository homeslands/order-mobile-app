import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { FormInput } from '@/components/form/form-input'
import { PasswordInputField } from '@/components/input'
import { ROUTE } from '@/constants'
import { useLogin, usePostAuthActions, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { loginSchema, TLoginSchema } from '@/schemas'
import type { ILoginResponse } from '@/types'
import { showErrorToastMessage } from '@/utils'

interface LoginFormProps {
  onLoginSuccess?: () => void
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const { t } = useTranslation('auth')

  const { control, handleSubmit, formState: { isSubmitting, errors } } =
    useZodForm(loginSchema, {
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
            const message = error instanceof Error ? error.message : 'Unknown error'
            showErrorToastMessage(message)
          }
        },
        onError: () => {
          // Global error handler (QueryCache) sẽ show toast
        },
      },
    )
  }

  // const handleQuickLogin = () => {
  //   setValue('phonenumber', '0324567894')
  //   setValue('password', '123456789a')
  //   clearErrors()
  // }

  const isLoading = isPending || isSubmitting

  return (
    <View className="flex-1 px-6 pt-12">
      <Text className="mb-2 text-3xl font-sans-bold text-gray-900 dark:text-white">
        {t('login.title')}
      </Text>
      <Text className="mb-8 text-base font-sans text-gray-500 dark:text-gray-400">
        {t('login.description')}
      </Text>

      {/* Phone */}
      <FormInput
        control={control}
        name="phonenumber"
        label={t('login.phoneNumber')}
        placeholder={t('login.enterPhoneNumber')}
        keyboardType="phone-pad"
        autoCapitalize="none"
        disabled={isLoading}
        useTextInput
        transformOnChange={(v) => v.replace(/\D/g, '')}
        labelClassName="text-md font-sans-medium text-gray-500 dark:text-gray-400"
      />

      {/* Password */}
      <View className="mb-6">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-md font-sans-medium text-gray-500 dark:text-gray-400">
            {t('login.password')}
          </Text>
          <TouchableOpacity
            onPress={() => navigateNative.push(ROUTE.FORGOT_PASSWORD)}
            disabled={isLoading}
            hitSlop={8}
          >
            <Text className="text-sm font-sans-semibold text-amber-500 dark:text-amber-400">
              {t('login.forgotPassword')}
            </Text>
          </TouchableOpacity>
        </View>
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

      {/* Quick login — dev helper, hardcoded acc */}
      {/* <TouchableOpacity
        className="mb-3 items-center justify-center rounded-lg border border-dashed border-border py-2"
        onPress={handleQuickLogin}
        disabled={isLoading}
      >
        <Text className="text-sm font-sans text-gray-500 dark:text-gray-400">
          Đăng nhập nhanh (0324567894)
        </Text>
      </TouchableOpacity> */}

      {/* Submit */}
      <TouchableOpacity
        className="items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-sans-semibold text-white">
            {t('login.login')}
          </Text>
        )}
      </TouchableOpacity>

      {/* Register link */}
      <TouchableOpacity
        className="mt-6 items-center"
        onPress={() => navigateNative.replace('/auth/register')}
        disabled={isLoading}
      >
        <Text className="text-sm font-sans text-gray-500 dark:text-gray-400">
          {t('login.noAccount')}{' '}
          <Text className="font-sans-semibold text-amber-500 dark:text-amber-400">
            {t('login.register')}
          </Text>
        </Text>
      </TouchableOpacity>

      {/* Back to home */}
      <TouchableOpacity
        className="mt-4 items-center"
        onPress={() => navigateNative.replace('/(tabs)/home')}
        disabled={isLoading}
      >
        <Text className="text-sm font-sans text-gray-500 dark:text-gray-400">
          {t('login.goBackToHome')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
