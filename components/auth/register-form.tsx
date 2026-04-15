import dayjs from 'dayjs'
import { Eye, EyeOff } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { useController } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { FormInput } from '@/components/form/form-input'
import { DobExpandablePicker } from '@/components/profile'
import { usePostAuthActions, useRegister, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { TRegisterSchema, useRegisterSchema } from '@/schemas'
import { showToast } from '@/utils'

const DEFAULT_DOB = dayjs().subtract(18, 'year').format('DD/MM/YYYY')

export default function RegisterForm() {
  const { t } = useTranslation('auth')
  const registerSchema = useRegisterSchema()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useZodForm(registerSchema, {
    mode: 'onTouched',
    defaultValues: {
      dob: DEFAULT_DOB,
      firstName: '',
      lastName: '',
      phonenumber: '',
      password: '',
      confirmPassword: '',
    },
  })

  const { mutate: registerMutation, isPending } = useRegister()
  const { handleAuthSuccess } = usePostAuthActions()

  const {
    field: { value: dobValue },
    fieldState: { error: dobError },
  } = useController({ control, name: 'dob' })


  const handleDobSelect = useCallback(
    (date: string) => {
      // Picker returns YYYY-MM-DD, convert to DD/MM/YYYY for schema
      const d = dayjs(date)
      if (d.isValid()) {
        setValue('dob', d.format('DD/MM/YYYY'))
      }
    },
    [setValue],
  )

  const onSubmit = (data: TRegisterSchema) => {
    registerMutation(
      {
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob,
        phonenumber: data.phonenumber,
        password: data.password,
      },
      {
        onSuccess: async (response) => {
          const tokens = response.result?.result ?? response.result
          if (tokens?.accessToken) {
            await handleAuthSuccess(tokens)
          }
          showToast(t('register.success'))
          navigateNative.replace('/auth/login')
        },
        onError: () => {
          // Global error handler (QueryCache) sẽ show toast
        },
      },
    )
  }

  const isLoading = isPending || isSubmitting

  return (
    <View className="flex-1 px-6 pt-8">
      <Text className="mb-2 text-3xl font-sans-bold text-foreground">
        {t('register.title')}
      </Text>
      <Text className="mb-8 text-base font-sans text-muted-foreground">
        {t('register.subtitle')}
      </Text>

      {/* Họ */}
      <FormInput
        control={control}
        name="lastName"
        label={t('register.lastName')}
        placeholder={t('register.enterLastName')}
        autoCapitalize="words"
        disabled={isLoading}
        useTextInput
      />

      {/* Tên */}
      <FormInput
        control={control}
        name="firstName"
        label={t('register.firstName')}
        placeholder={t('register.enterFirstName')}
        autoCapitalize="words"
        disabled={isLoading}
        useTextInput
      />

      {/* Ngày sinh */}
      <View className="mb-4">
        <Text className="mb-1 text-xs text-muted-foreground">
          {t('register.dob')}
        </Text>
        <DobExpandablePicker
          value={dobValue}
          onSelect={handleDobSelect}
          placeholder={t('register.selectDob')}
        />
        {dobError && (
          <Text className="mt-1 text-xs text-destructive">{dobError.message}</Text>
        )}
      </View>

      {/* Số điện thoại */}
      <FormInput
        control={control}
        name="phonenumber"
        label={t('register.phoneNumber')}
        placeholder={t('register.enterPhoneNumber')}
        keyboardType="phone-pad"
        autoCapitalize="none"
        disabled={isLoading}
        useTextInput
        transformOnChange={(v) => v.replace(/\D/g, '')}
      />

      {/* Mật khẩu */}
      <View>
        <Text className="mb-1 text-xs text-muted-foreground">
          {t('register.password')}
        </Text>
        <View className="mb-4">
          <FormInput
            control={control}
            name="password"
            placeholder={t('register.enterPassword')}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            disabled={isLoading}
            useTextInput
            containerClassName="mb-0"
            className="pr-12"
          />
          <TouchableOpacity
            className="absolute bottom-3 right-4 p-1"
            onPress={() => setShowPassword((v) => !v)}
            disabled={isLoading}
            hitSlop={8}
          >
            {showPassword ? (
              <EyeOff size={20} color="#9ca3af" />
            ) : (
              <Eye size={20} color="#9ca3af" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Xác nhận mật khẩu */}
      <View>
        <Text className="mb-1 text-xs text-muted-foreground">
          {t('register.confirmPassword')}
        </Text>
        <View className="mb-8">
          <FormInput
            control={control}
            name="confirmPassword"
            placeholder={t('register.enterConfirmPassword')}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            disabled={isLoading}
            useTextInput
            containerClassName="mb-0"
            className="pr-12"
          />
          <TouchableOpacity
            className="absolute bottom-3 right-4 p-1"
            onPress={() => setShowConfirmPassword((v) => !v)}
            disabled={isLoading}
            hitSlop={8}
          >
            {showConfirmPassword ? (
              <EyeOff size={20} color="#9ca3af" />
            ) : (
              <Eye size={20} color="#9ca3af" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit */}
      <TouchableOpacity
        className="mb-6 items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-sans-semibold text-primary-foreground">
            {t('register.register')}
          </Text>
        )}
      </TouchableOpacity>

      {/* Login link */}
      <TouchableOpacity
        className="mb-4 items-center"
        onPress={() => navigateNative.replace('/auth/login')}
        disabled={isLoading}
      >
        <Text className="text-sm font-sans text-muted-foreground">
          {t('register.haveAccount')}{' '}
          <Text className="font-sans-semibold text-primary">{t('register.login')}</Text>
        </Text>
      </TouchableOpacity>

      {/* Back to home */}
      <TouchableOpacity
        className="mb-8 items-center"
        onPress={() => navigateNative.replace('/(tabs)/home')}
        disabled={isLoading}
      >
        <Text className="text-sm font-sans text-muted-foreground">
          {t('register.goBackToHome')}
        </Text>
      </TouchableOpacity>

    </View>
  )
}
