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
import {
  ChevronLeft,
  Fingerprint,
  ScanFace,
  UserRound,
} from 'lucide-react-native'
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
  classifyLoginError,
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
import { extractStatusCode } from '@/lib/global-error-gate'
import { showErrorToastMessage, showToast } from '@/utils'

import { getLoginView, maskPhone, type LoginMode } from './login-view'

interface LoginFormProps {
  onLoginSuccess?: () => void
  onBeforeNavigate?: () => void
  onLoadingChange?: (isLoading: boolean) => void
  /** true khi đang ở màn chào khách quen / nhập mật khẩu của số đã bật Face
   *  ID — panel ẩn tiêu đề "Đăng nhập" và link đăng ký. */
  onReturningUserChange?: (isReturning: boolean) => void
}

export default function LoginForm({
  onLoginSuccess,
  onBeforeNavigate,
  onLoadingChange,
  onReturningUserChange,
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

  // Đã bật Face ID / vân tay: chào khách quen → (mật khẩu | tài khoản khác).
  // Mỗi lần mở màn bắt đầu ở màn chào.
  const [mode, setMode] = useState<LoginMode>('greeting')
  const view = getLoginView(!!bioType && !!bioPhone, mode)
  const isReturningView = view === 'greeting' || view === 'password'

  useEffect(() => {
    onReturningUserChange?.(isReturningView)
  }, [isReturningView, onReturningUserChange])

  const showPasswordMode = useCallback(() => setMode('password'), [])
  const showOtherAccount = useCallback(() => {
    setValue('phonenumber', '')
    setValue('password', '')
    clearErrors()
    setMode('other')
  }, [setValue, clearErrors])
  const backToGreeting = useCallback(() => {
    if (bioPhone) setValue('phonenumber', bioPhone)
    setValue('password', '')
    clearErrors()
    setMode('greeting')
  }, [bioPhone, setValue, clearErrors])

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
          const kind = classifyLoginError(error)
          // Mất mạng không phải sai mật khẩu: không tô đỏ/lắc. Lỗi không có
          // mã nên global error handler bỏ qua — tự báo ở đây. Đăng nhập bằng
          // sinh trắc học thì giữ dữ liệu đã lưu để thử lại.
          if (kind === 'network') {
            showToast(t('login.networkError'), 'error')
            return
          }
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
          // Toast do global error handler (MutationCache) đảm nhiệm.
          // Ở đây chỉ lo phản hồi tại chỗ khi sai thông tin: viền đỏ + lắc +
          // haptic. Lỗi server (5xx, 429…) không tô đỏ vì không phải lỗi
          // của khách.
          if (kind === 'credentials') triggerErrorFeedback()
          // Cổng API trả 5xx dạng HTML: body không có mã nên global handler
          // không báo gì — tự báo để khách biết bấm đã có phản hồi.
          else if (kind === 'other' && extractStatusCode(error) == null) {
            showToast(t('login.serverError'), 'error')
          }
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
    // Huỷ quét (kể cả từ màn nhập mật khẩu) thì về màn chào.
    if (result.status === 'cancelled') {
      setMode('greeting')
      return
    }
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
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const mutedColor = isDark
    ? colors.mutedForeground.dark
    : colors.mutedForeground.light
  const textColor = isDark ? colors.foreground.dark : colors.foreground.light
  const bioMethod = bioType ? t(biometricLabelKey(bioType)) : ''
  const BioIcon = bioType === 'face' ? ScanFace : Fingerprint
  const maskedPhone = bioPhone ? maskPhone(bioPhone) : ''

  useEffect(() => {
    onLoadingChange?.(isLoading)
  }, [isLoading, onLoadingChange])

  const phoneField = (
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
      autoFocus={view === 'other'}
      useTextInput
      transformOnChange={(v) => v.replace(/\D/g, '')}
      labelClassName="text-sm font-sans-medium text-gray-500 dark:text-gray-400"
      containerClassName="mb-4"
    />
  )

  const passwordField = (
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
            autoFocus={view === 'password'}
          />
        )}
      />
    </View>
  )

  const forgotLink = (
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
  )

  const loginButton = (
    <TouchableOpacity
      className="mt-6 items-center justify-center rounded-lg bg-primary py-4"
      onPress={handleSubmit(onSubmit)}
      disabled={isLoading}
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator color={colors.white.light} />
      ) : (
        <Text className="font-sans-semibold text-base text-white">
          {t('login.login')}
        </Text>
      )}
    </TouchableOpacity>
  )

  const changeButton = (
    <TouchableOpacity
      testID="change-account-button"
      accessibilityRole="button"
      accessibilityLabel={t('login.changeAccountA11y')}
      onPress={showOtherAccount}
      disabled={isLoading}
      hitSlop={12}
      className="px-2 py-1"
    >
      <Text className="font-sans-semibold text-base text-primary">
        {t('login.changeAccount')}
      </Text>
    </TouchableOpacity>
  )

  const avatar = (size: number) => (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: `${primaryColor}1F`,
      }}
    >
      <UserRound size={size * 0.5} color={primaryColor} />
    </View>
  )

  const notYouRow = (
    <View className="mt-8 flex-row flex-wrap items-center justify-center">
      <Text className="font-sans text-sm" style={{ color: mutedColor }}>
        {t('login.notYou')}{' '}
      </Text>
      <TouchableOpacity
        testID="other-account-link"
        accessibilityRole="button"
        onPress={showOtherAccount}
        disabled={isLoading}
        hitSlop={12}
      >
        <Text className="font-sans-semibold text-sm text-primary">
          {t('login.otherAccount')}
        </Text>
      </TouchableOpacity>
    </View>
  )

  // Đã bật Face ID / vân tay: màn chào khách quen, một nút chính. Chỉ quét khi
  // khách bấm — tự quét thì Face ID nhận mặt gần như tức thì, khách không kịp
  // chọn mật khẩu hay tài khoản khác.
  if (view === 'greeting') {
    return (
      <View testID="login-greeting">
        <View className="items-center">
          {avatar(80)}
          <Text
            className="mt-5 text-center font-sans-bold text-2xl"
            style={{ color: textColor }}
          >
            {t('login.welcomeBack')}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Text className="font-sans text-base" style={{ color: mutedColor }}>
              {maskedPhone}
            </Text>
            {changeButton}
          </View>
        </View>

        <TouchableOpacity
          testID="biometric-login-button"
          accessibilityRole="button"
          accessibilityLabel={t('biometric.prompt', { method: bioMethod })}
          className="mt-10 flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-4"
          onPress={loginWithBiometric}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white.light} />
          ) : (
            <>
              <BioIcon size={22} color={colors.white.light} />
              <Text className="font-sans-semibold text-base text-white">
                {t('biometric.prompt', { method: bioMethod })}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          testID="use-password-button"
          accessibilityRole="button"
          className="mt-3 items-center justify-center py-3"
          onPress={showPasswordMode}
          disabled={isLoading}
        >
          <Text className="font-sans-semibold text-base text-primary">
            {t('login.usePassword')}
          </Text>
        </TouchableOpacity>

        {notYouRow}
      </View>
    )
  }

  // Đang nhập mật khẩu cho số đã bật: giữ lời chào, có nút quét lại ngay.
  if (view === 'password') {
    return (
      <View>
        <View className="flex-row items-center gap-3">
          {avatar(52)}
          <View className="flex-1">
            <Text
              className="font-sans-bold text-xl"
              style={{ color: textColor }}
            >
              {t('login.welcomeBack')}
            </Text>
            <Text className="font-sans text-sm" style={{ color: mutedColor }}>
              {maskedPhone}
            </Text>
          </View>
          {changeButton}
        </View>

        <Animated.View style={[shakeStyle, { marginTop: 28 }]}>
          {passwordField}
        </Animated.View>
        {forgotLink}
        {loginButton}

        <TouchableOpacity
          testID="use-biometric-button"
          accessibilityRole="button"
          accessibilityLabel={t('biometric.use', { method: bioMethod })}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-lg border border-primary px-4 py-3"
          style={{ minHeight: 48 }}
          onPress={loginWithBiometric}
          disabled={isLoading}
        >
          <BioIcon size={20} color={primaryColor} />
          <Text className="font-sans-semibold text-base text-primary">
            {t('biometric.use', { method: bioMethod })}
          </Text>
        </TouchableOpacity>

        {notYouRow}
      </View>
    )
  }

  // Chưa bật (standard) hoặc đổi sang tài khoản khác (other).
  return (
    <View>
      {view === 'other' ? (
        <TouchableOpacity
          testID="back-to-greeting"
          accessibilityRole="button"
          className="mb-4 flex-row items-center gap-1 self-start py-2"
          onPress={backToGreeting}
          disabled={isLoading}
          hitSlop={8}
        >
          <ChevronLeft size={18} color={primaryColor} />
          <Text className="font-sans-semibold text-sm text-primary">
            {t('login.backTo', { phone: maskedPhone })}
          </Text>
        </TouchableOpacity>
      ) : null}

      <Animated.View style={shakeStyle}>
        {phoneField}
        {passwordField}
      </Animated.View>
      {forgotLink}
      {loginButton}
    </View>
  )
}
