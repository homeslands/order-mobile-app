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
import { NavigationContext } from '@react-navigation/native'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
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

// Màn chứa form có đang hiện không. Tab Account dựng form đăng nhập ngay khi
// đăng xuất dù tab đang ẩn; không chặn thì hộp Face ID / vân tay bật đè lên
// Home. Ngoài navigator (test, sheet) thì coi như đang hiện.
function useScreenFocused(): boolean {
  const navigation = useContext(NavigationContext)
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true)
  useEffect(() => {
    if (!navigation) return
    const offFocus = navigation.addListener('focus', () => setFocused(true))
    const offBlur = navigation.addListener('blur', () => setFocused(false))
    return () => {
      offFocus()
      offBlur()
    }
  }, [navigation])
  return focused
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
  const autoPrompted = useRef(false)
  const isFocused = useScreenFocused()
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

  // Tự hiện hộp xác thực một lần mỗi lần khách mở tới màn này (focus). Khách
  // huỷ thì ở lại form. Rời màn thì lần sau quay lại được hỏi lại.
  useEffect(() => {
    if (!isFocused) {
      autoPrompted.current = false
      return
    }
    if (!bioType || !bioPhone || autoPrompted.current) return
    autoPrompted.current = true
    void loginWithBiometric()
  }, [isFocused, bioType, bioPhone, loginWithBiometric])

  const isLoading = isPending || isSubmitting

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

      <View className="mt-6 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 items-center justify-center rounded-lg bg-primary py-4"
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
        {bioType && bioPhone ? (
          <TouchableOpacity
            testID="biometric-login-button"
            accessibilityRole="button"
            accessibilityLabel={t('biometric.prompt', {
              method: t(biometricLabelKey(bioType)),
            })}
            className="w-14 items-center justify-center rounded-lg border border-primary"
            onPress={loginWithBiometric}
            disabled={isLoading}
          >
            {bioType === 'face' ? (
              <ScanFace
                size={26}
                color={isDark ? colors.primary.dark : colors.primary.light}
              />
            ) : (
              <Fingerprint
                size={26}
                color={isDark ? colors.primary.dark : colors.primary.light}
              />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}
