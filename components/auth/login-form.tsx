import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import {
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react-native'
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
import { ROUTE, colors } from '@/constants'
import { SHAKE } from '@/constants/motion'
import { useLogin, usePostAuthActions, useZodForm } from '@/hooks'
import {
  biometricLabelKey,
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricType,
  getEnabledPhone,
  readBiometricCredentials,
  shouldDisableAfterLoginError,
  type BiometricType,
} from '@/lib/biometric-login'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { useLoginSchema, TLoginSchema } from '@/schemas'
import type { ILoginResponse } from '@/types'
import { showErrorToastMessage, showToast } from '@/utils'

interface LoginFormProps {
  onLoginSuccess?: () => void
  onBeforeNavigate?: () => void
  onLoadingChange?: (isLoading: boolean) => void
}

export default function LoginForm({
  onLoginSuccess,
  onBeforeNavigate,
  onLoadingChange,
}: LoginFormProps) {
  const { t } = useTranslation('auth')
  const loginSchema = useLoginSchema()

  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useZodForm(loginSchema, {
    defaultValues: { phonenumber: '', password: '' },
  })

  const { mutate: loginMutation, isPending } = useLogin()
  const { handleAuthSuccess } = usePostAuthActions()

  // reValidateMode: 'onChange' của RHF chỉ tự xoá lỗi của ô vừa sửa. Spec
  // yêu cầu sửa BẤT KỲ ô nào cũng xoá viền đỏ ở CẢ 2 ô, nên tự bù thêm ở
  // đây — chỉ khi đang thực sự có lỗi 'server' cần xoá (tránh chạy clearErrors
  // ở lần render đầu hoặc khi chưa từng có lỗi).
  useEffect(() => {
    const subscription = watch(() => {
      if (
        errors.phonenumber?.type === 'server' ||
        errors.password?.type === 'server'
      ) {
        clearErrors(['phonenumber', 'password'])
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, clearErrors, errors.phonenumber?.type, errors.password?.type])

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

  // Đăng nhập bằng sinh trắc học (lib/biometric-login.ts): loại sinh trắc
  // học của máy và số điện thoại đã bật. Cả hai có thì hiện nút.
  const [bioType, setBioType] = useState<BiometricType | null>(null)
  const [bioPhone, setBioPhone] = useState<string | null>(null)
  const isDark = useColorScheme() === 'dark'

  // Sau khi đăng nhập bằng MẬT KHẨU thành công: số khác số đã bật thì xoá
  // bản cũ (một máy chỉ giữ một tài khoản), rồi mời bật cho số này. Mật khẩu
  // chỉ sống trong closure của Alert, không qua store nào.
  const offerBiometric = useCallback(
    async (phonenumber: string, password: string) => {
      const enabledPhone = await getEnabledPhone()
      if (enabledPhone === phonenumber) return
      if (enabledPhone) await disableBiometricLogin()
      const type = await getBiometricType()
      if (!type) return
      const method = t(biometricLabelKey(type))
      Alert.alert(
        t('biometric.offerTitle', { method }),
        t('biometric.offerMessage'),
        [
          { text: t('biometric.offerLater'), style: 'cancel' },
          {
            text: t('biometric.offerEnable'),
            onPress: async () => {
              const ok = await enableBiometricLogin(
                phonenumber,
                password,
                t('biometric.enablePrompt', { method }),
              )
              if (ok) showToast(t('biometric.enabled', { method }))
            },
          },
        ],
      )
    },
    [t],
  )

  const submitLogin = (
    phonenumber: string,
    password: string,
    viaBiometric: boolean,
  ) => {
    loginMutation(
      { phonenumber, password },
      {
        onSuccess: async (response: ILoginResponse) => {
          try {
            await handleAuthSuccess(response.result, onLoginSuccess)
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error'
            showErrorToastMessage(message)
            return
          }
          if (!viaBiometric) void offerBiometric(phonenumber, password)
        },
        onError: (error) => {
          // Mật khẩu đã lưu bị server từ chối (đổi ở nơi khác…): tắt hẳn,
          // khách nhập mật khẩu và được mời bật lại.
          if (viaBiometric && shouldDisableAfterLoginError(error)) {
            void disableBiometricLogin()
            setBioPhone(null)
            if (bioType) {
              showToast(
                t('biometric.rejected', {
                  method: t(biometricLabelKey(bioType)),
                }),
                'info',
              )
            }
            return
          }
          // Toast do global error handler (QueryCache) đảm nhiệm.
          // Ở đây chỉ lo phản hồi tại chỗ: viền đỏ + lắc + haptic.
          triggerErrorFeedback()
        },
      },
    )
  }

  const onSubmit = (data: TLoginSchema) =>
    submitLogin(data.phonenumber, data.password, false)

  const loginWithBiometric = useCallback(async () => {
    if (!bioType) return
    const method = t(biometricLabelKey(bioType))
    const result = await readBiometricCredentials(
      t('biometric.prompt', { method }),
    )
    if (result.status === 'cancelled') return
    if (result.status === 'invalidated') {
      setBioPhone(null)
      showToast(t('biometric.invalidated', { method }), 'info')
      return
    }
    submitLogin(result.phonenumber, result.password, true)
    // submitLogin đổi mỗi render nhưng chỉ đọc giá trị ổn định của hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioType, t])

  useEffect(() => {
    let alive = true
    void Promise.all([getBiometricType(), getEnabledPhone()]).then(
      ([type, phone]) => {
        if (!alive) return
        setBioType(type)
        setBioPhone(phone)
        if (phone) setValue('phonenumber', phone)
      },
    )
    return () => {
      alive = false
    }
  }, [setValue])

  const isLoading = isPending || isSubmitting
  const bioPrompt = bioType
    ? t('biometric.prompt', { method: t(biometricLabelKey(bioType)) })
    : ''
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const dividerColor = isDark ? colors.border.dark : colors.border.light
  const mutedColor = isDark
    ? colors.mutedForeground.dark
    : colors.mutedForeground.light

  useEffect(() => {
    onLoadingChange?.(isLoading)
  }, [isLoading, onLoadingChange])

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
          labelClassName="text-sm font-sans-medium text-gray-500 dark:text-gray-400"
          containerClassName="mb-4"
        />

        {/* Chỉ quét khi khách bấm: tự quét thì Face ID nhận mặt gần như tức
            thì, khách không kịp huỷ để đăng nhập tài khoản khác. */}
        {bioType && bioPhone ? (
          <>
            <TouchableOpacity
              testID="biometric-login-button"
              accessibilityRole="button"
              accessibilityLabel={bioPrompt}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-primary px-4 py-3"
              style={{ minHeight: 48 }}
              onPress={loginWithBiometric}
              disabled={isLoading}
            >
              {bioType === 'face' ? (
                <ScanFace size={22} color={primaryColor} />
              ) : (
                <Fingerprint size={22} color={primaryColor} />
              )}
              <Text className="font-sans-semibold text-base text-primary">
                {bioPrompt}
              </Text>
            </TouchableOpacity>

            <View className="my-4 flex-row items-center gap-3">
              <View
                className="h-px flex-1"
                style={{ backgroundColor: dividerColor }}
              />
              <Text className="text-sm" style={{ color: mutedColor }}>
                {t('login.or')}
              </Text>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: dividerColor }}
              />
            </View>
          </>
        ) : null}

        <View>
          <Text className="mb-1 font-sans-medium text-sm text-gray-500 dark:text-gray-400">
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

      <View className="mt-6">
        <TouchableOpacity
          className="items-center justify-center rounded-lg bg-primary py-4"
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
    </View>
  )
}
