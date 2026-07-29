import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useCallback } from 'react'
import Animated, {
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { FormInput } from '@/components/form/form-input'
import { PasswordInputField } from '@/components/input'
import { Text } from '@/components/ui/text'
import { ROUTE } from '@/constants'
import { SHAKE } from '@/constants/motion'
import { useLogin, usePostAuthActions, useZodForm } from '@/hooks'
import { navigateWhenUnlocked } from '@/lib/navigation'
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
    setError,
    formState: { isSubmitting, errors },
  } = useZodForm(loginSchema, {
    defaultValues: { phonenumber: '', password: '' },
  })

  const { mutate: loginMutation, isPending } = useLogin()
  const { handleAuthSuccess } = usePostAuthActions()

  const shakeX = useSharedValue(0)
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }))

  const triggerErrorFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setError('phonenumber', { type: 'server', message: '' })
    setError('password', { type: 'server', message: '' })
    runOnUI(() => {
      'worklet'
      shakeX.value = withSequence(
        withTiming(-SHAKE.offset, { duration: SHAKE.segmentMs }),
        withTiming(SHAKE.offset, { duration: SHAKE.segmentMs }),
        withTiming(-SHAKE.offset / 2, { duration: SHAKE.segmentMs }),
        withTiming(SHAKE.offset / 2, { duration: SHAKE.segmentMs }),
        withTiming(0, { duration: SHAKE.segmentMs }),
      )
    })()
  }, [setError, shakeX])

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
          // Toast do global error handler (QueryCache) đảm nhiệm.
          // Ở đây chỉ lo phản hồi tại chỗ: viền đỏ + lắc + haptic.
          triggerErrorFeedback()
        },
      },
    )
  }

  const isLoading = isPending || isSubmitting

  return (
    <View>
      <Animated.View style={shakeStyle}>
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
          <Text className="text-md mb-1 font-sans-medium text-gray-500 dark:text-gray-400">
            {t('login.password')}
          </Text>
          <Controller
            control={control}
            name="password"
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid },
            }) => (
              <PasswordInputField
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={t('login.enterPassword')}
                disabled={isLoading}
                error={errors.password?.message}
                invalid={invalid}
              />
            )}
          />
        </View>
      </Animated.View>

      <TouchableOpacity
        className="mt-2 self-start"
        onPress={() => {
          onBeforeNavigate?.()
          // navigateWhenUnlocked: retry nếu navigation lock đang active (khi
          // sheet đang đóng) thay vì silent drop như navigateNative.push.
          navigateWhenUnlocked.push(ROUTE.FORGOT_PASSWORD)
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
