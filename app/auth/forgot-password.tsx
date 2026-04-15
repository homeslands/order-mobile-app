import { Redirect, Stack } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import {
  OTPStepForgot,
  ResetStepForgot,
  SuccessStepForgot,
} from '@/components/auth'
import { ForgotPasswordIdentityForm } from '@/components/form'
import { Button } from '@/components/ui'
import { ScreenContainer } from '@/components/layout'
import { EMAIL_REGEX, ROUTE, VerificationMethod } from '@/constants'
import {
  useConfirmForgotPassword,
  useInitiateForgotPassword,
  useResendOTPForgotPassword,
  useShakeAnimation,
  useVerifyOTPForgotPassword,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import {
  type TForgotPasswordIdentitySchema,
  type TResetPasswordSchema,
} from '@/schemas'
import { useAuthStore } from '@/stores'
import {
  useEmail,
  useExpireTime,
  useIdentityActions,
  useOTPActions,
  usePhoneNumber,
  useStep,
  useStepActions,
  useToken,
  useTokenExpireTime,
  useVerificationMethod,
} from '@/stores/selectors/forgot-password'
import {
  maskIdentity,
  showErrorToast,
  showErrorToastMessage,
  showToast,
} from '@/utils'

function extractErrorCode(err: unknown): number | undefined {
  const data = (
    err as {
      response?: { data?: { code?: number; statusCode?: number } }
    }
  )?.response?.data
  return data?.code ?? data?.statusCode
}

/** Show error toast with fallback for network errors (no response) */
function handleMutationError(err: unknown) {
  const code = extractErrorCode(err)
  if (typeof code === 'number') {
    showErrorToast(code)
  } else {
    showErrorToastMessage('toast.requestFailed')
  }
}

function applyOtpBuffer(expiresAt: string): string {
  const expiresMs = new Date(expiresAt).getTime()
  if (isNaN(expiresMs)) return '' // G1: guard invalid date
  const remainingMs = expiresMs - Date.now()
  if (remainingMs <= 30_000) return expiresAt
  return new Date(expiresMs - 30_000).toISOString()
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation('auth')
  const { t: tToast } = useTranslation('toast')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  // Store state
  const email = useEmail()
  const phoneNumber = usePhoneNumber()
  const step = useStep()
  const token = useToken()
  const expireTime = useExpireTime()
  const tokenExpireTime = useTokenExpireTime()
  const verificationMethod = useVerificationMethod()

  // Store actions
  const { setEmail, setPhoneNumber, setVerificationMethod } =
    useIdentityActions()
  const { setStep, clearForgotPassword } = useStepActions()
  const { setToken, setTokenExpireTime, setExpireTime } =
    useOTPActions()

  // Local state
  const [otpValue, setOtpValue] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  // Mutations
  const { mutate: initiate, isPending: isInitiating } =
    useInitiateForgotPassword()
  const { mutate: verifyOTP, isPending: isVerifyingOTP } =
    useVerifyOTPForgotPassword()
  const { mutate: confirm, isPending: isConfirming } =
    useConfirmForgotPassword()
  const { mutate: resendOTP, isPending: isResending } =
    useResendOTPForgotPassword()

  // Shake animation for OTP error
  const { translateX: shakeTranslateX, shake } = useShakeAnimation()

  // Ref to prevent double auto-submit
  const autoSubmitRef = useRef(false)

  // ── Flow recovery on mount ──────────────────────────────────────
  useEffect(() => {
    if (expireTime && step === 1) {
      const timeLeft = Math.floor(
        (new Date(expireTime).getTime() - Date.now()) / 1000,
      )
      if (timeLeft > 0) setStep(2)
      else setExpireTime('')
    }
    if (tokenExpireTime && step === 3) {
      const timeLeft = Math.floor(
        (new Date(tokenExpireTime).getTime() - Date.now()) / 1000,
      )
      if (timeLeft <= 0) {
        setToken('')
        setTokenExpireTime('')
        setStep(1)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── F4: Android back button intercept at step 2/3 ──────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return
    if (step !== 2 && step !== 3) return

    const onBackPress = () => {
      handleBack()
      return true // prevent default back
    }

    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    )
    return () => sub.remove()
    // handleBack depends on step — re-subscribe when step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Auto-detect verification method ─────────────────────────────
  const detectMethod = useCallback(
    (identity: string): VerificationMethod =>
      EMAIL_REGEX.test(identity)
        ? VerificationMethod.EMAIL
        : VerificationMethod.PHONE_NUMBER,
    [],
  )

  // ── Step 1: Submit identity ─────────────────────────────────────
  const handleSubmit = useCallback(
    (value: TForgotPasswordIdentitySchema) => {
      const method = detectMethod(value.identity)
      const isEmail = method === VerificationMethod.EMAIL
      const identity = value.identity

      // Check if OTP from previous attempt is still valid (MUST be same method + same identity)
      const storedIdentity = isEmail ? email : phoneNumber
      const isSameIdentity = storedIdentity === identity
      const isSameMethod = verificationMethod === method

      if (expireTime && isSameIdentity && isSameMethod) {
        const timeLeft = Math.floor(
          (new Date(expireTime).getTime() - Date.now()) / 1000,
        )
        if (timeLeft > 0) {
          showToast(tToast('toast.otpStillValid'))
          setVerificationMethod(method)
          if (isEmail) setEmail(identity)
          else setPhoneNumber(identity)
          setStep(2)
          return
        }
      }

      // Clear OTP state if switching to different verification method
      if (verificationMethod !== method) {
        setExpireTime('')
        setOtpValue('')
      }

      setVerificationMethod(method)
      if (isEmail) setEmail(identity)
      else setPhoneNumber(identity)

      const payload = isEmail
        ? { email: identity, verificationMethod: method }
        : { phonenumber: identity, verificationMethod: method }

      initiate(payload, {
        onSuccess: (response) => {
          const buffered = applyOtpBuffer(
            response?.result?.expiresAt || '',
          )
          // G1: guard empty/invalid expiresAt
          if (!buffered) {
            showErrorToastMessage('toast.requestFailed')
            return
          }
          showToast(
            tToast(
              isEmail
                ? 'toast.sendVerifyEmailSuccess'
                : 'toast.sendVerifyPhoneNumberSuccess',
            ),
          )
          setExpireTime(buffered)
          setStep(2)
        },
        onError: (err: unknown) => {
          const errorCode = extractErrorCode(err)
          // Backend error code 119009 = OTP already sent
          const isOTPAlreadySent = errorCode === 119009
          const isOTPStillValid =
            expireTime &&
            new Date(expireTime).getTime() > Date.now()

          // If OTP already sent (119009) but no local expireTime, set a default timeout
          if (isOTPAlreadySent && !isOTPStillValid) {
            // Set 10-minute default expiry for OTP that was already sent
            setExpireTime(
              new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            )
            setStep(2)
            // Show user-friendly message
            showToast(tToast('toast.otpAlreadySent'))
            return
          }

          // Original logic: if local expireTime is valid, jump to OTP input
          if (isOTPStillValid) {
            setStep(2)
          } else {
            // No valid OTP, show error
            handleMutationError(err)
          }
        },
      })
    },
    [
      detectMethod,
      email,
      phoneNumber,
      expireTime,
      verificationMethod,
      setEmail,
      setPhoneNumber,
      setVerificationMethod,
      setExpireTime,
      setOtpValue,
      setStep,
      initiate,
      tToast,
    ],
  )

  // ── Step 2: Verify OTP ──────────────────────────────────────────
  const handleVerifyOTP = useCallback(() => {
    if (otpValue.length !== 6 || isVerifyingOTP) return
    autoSubmitRef.current = false

    verifyOTP(
      { code: otpValue },
      {
        onSuccess: (response) => {
          const receivedToken = response?.result?.token
          // G2: guard empty token
          if (!receivedToken) {
            showErrorToastMessage('toast.requestFailed')
            return
          }
          showToast(tToast('toast.verifyOTPSuccess'))
          setToken(receivedToken)
          setTokenExpireTime(
            new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          )
          setOtpValue('')
          setStep(3)
        },
        onError: (err: unknown) => {
          shake()
          setOtpValue('')
          handleMutationError(err)
        },
      },
    )
  }, [
    otpValue,
    isVerifyingOTP,
    verifyOTP,
    setToken,
    setTokenExpireTime,
    setStep,
    shake,
    tToast,
  ])

  // ── Auto-submit OTP when 6 digits entered ───────────────────────
  useEffect(() => {
    if (
      otpValue.length === 6 &&
      !isVerifyingOTP &&
      !autoSubmitRef.current
    ) {
      autoSubmitRef.current = true
      handleVerifyOTP()
    }
  }, [otpValue, isVerifyingOTP, handleVerifyOTP])

  // ── Step 3: Confirm new password ────────────────────────────────
  const handleConfirm = useCallback(
    (data: TResetPasswordSchema) => {
      confirm(
        { newPassword: data.newPassword, token: data.token },
        {
          onSuccess: () => {
            clearForgotPassword()
            setIsSuccess(true)
          },
          onError: handleMutationError,
        },
      )
    },
    [confirm, clearForgotPassword],
  )

  // ── Resend OTP ──────────────────────────────────────────────────
  const handleResendOTP = useCallback(() => {
    const isEmail =
      verificationMethod === VerificationMethod.EMAIL
    const payload = isEmail
      ? { email, verificationMethod }
      : { phonenumber: phoneNumber, verificationMethod }

    resendOTP(payload, {
      onSuccess: (response) => {
        const buffered = applyOtpBuffer(
          response?.result?.expiresAt || '',
        )
        if (!buffered) {
          showErrorToastMessage('toast.requestFailed')
          return
        }
        showToast(
          tToast(
            isEmail
              ? 'toast.sendVerifyEmailSuccess'
              : 'toast.sendVerifyPhoneNumberSuccess',
          ),
        )
        setExpireTime(buffered)
        setOtpValue('')
      },
      onError: handleMutationError,
    })
  }, [
    email,
    phoneNumber,
    verificationMethod,
    resendOTP,
    setExpireTime,
    tToast,
  ])

  // ── Navigation handlers ─────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (step === 2) {
      setStep(1)
      setOtpValue('')
      setExpireTime('')
    } else if (step === 3) {
      setStep(1)
      setOtpValue('')
      setExpireTime('')
      setToken('')
      setTokenExpireTime('')
    } else {
      navigateNative.back()
    }
  }, [step, setStep, setExpireTime, setToken, setTokenExpireTime])

  const handleOtpChange = useCallback(
    (v: string) => setOtpValue(v),
    [],
  )

  const handleStartOver = useCallback(() => {
    clearForgotPassword()
    setStep(1)
  }, [clearForgotPassword, setStep])

  const handleGoToLogin = useCallback(() => {
    navigateNative.replace(ROUTE.LOGIN)
  }, [])

  // no-op: step components manage expired UI internally
  const handleOtpExpired = useCallback(() => {}, [])
  const handleTokenExpired = useCallback(() => {}, [])

  // ── Derived values ──────────────────────────────────────────────
  const currentIdentity = email || phoneNumber
  const maskedId = useMemo(
    () =>
      currentIdentity
        ? maskIdentity(currentIdentity, verificationMethod)
        : '',
    [currentIdentity, verificationMethod],
  )

  const title = useMemo(() => {
    if (isSuccess) return ''
    if (step === 2) return t('forgotPassword.otpInputTitle')
    if (step === 3) return t('forgotPassword.resetPassword')
    return t('forgotPassword.title')
  }, [step, isSuccess, t])

  const description = useMemo(() => {
    if (isSuccess) return ''
    if (step === 2) return t('forgotPassword.otpInputDescription')
    if (step === 3)
      return t('forgotPassword.resetPasswordDescription')
    return ''
  }, [step, isSuccess, t])

  // ── Render ──────────────────────────────────────────────────────
  if (isAuthenticated) return <Redirect href="/(tabs)/home" />

  // Determine current visible step
  const activeStep = isSuccess ? 4 : step
  const gestureEnabled = activeStep === 1 || activeStep === 4

  return (
    <>
      <Stack.Screen
        options={{
          fullScreenGestureEnabled: gestureEnabled,
          gestureEnabled,
        }}
      />
      <ScreenContainer edges={['top']} className="flex-1">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-6 pt-8">
              {title ? (
                <Text className="mb-2 text-3xl font-sans-bold text-foreground">
                  {title}
                </Text>
              ) : null}
              {description ? (
                <Text className="mb-8 text-base font-sans text-muted-foreground">
                  {description}
                </Text>
              ) : null}

              {/* Step 1: Identity input */}
              {activeStep === 1 && (
                <ForgotPasswordIdentityForm
                  onSubmit={handleSubmit}
                  isLoading={isInitiating}
                />
              )}

              {/* Step 2: OTP verification */}
              {activeStep === 2 && expireTime ? (
                <OTPStepForgot
                  expiresAt={expireTime}
                  otpValue={otpValue}
                  onOtpChange={handleOtpChange}
                  isResending={isResending}
                  isVerifyingOTP={isVerifyingOTP}
                  onVerify={handleVerifyOTP}
                  onResend={handleResendOTP}
                  onBack={handleBack}
                  onExpired={handleOtpExpired}
                  maskedIdentity={maskedId}
                  shakeTranslateX={shakeTranslateX}
                />
              ) : activeStep === 2 ? (
                <TouchableOpacity
                  onPress={handleBack}
                  className="py-2"
                >
                  <Text className="text-center text-sm font-sans-medium text-primary">
                    {t('forgotPassword.backButton')}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Step 3: Reset password */}
              {activeStep === 3 && tokenExpireTime ? (
                <ResetStepForgot
                  token={token}
                  expiresAt={tokenExpireTime}
                  isConfirming={isConfirming}
                  onConfirm={handleConfirm}
                  onStartOver={handleStartOver}
                  onBackToLogin={handleGoToLogin}
                  onExpired={handleTokenExpired}
                />
              ) : activeStep === 3 ? (
                <View className="gap-3">
                  <Text className="text-center text-sm font-sans text-destructive">
                    {t('forgotPassword.sessionExpired')}
                  </Text>
                  <Button
                    variant="primary"
                    className="h-11 rounded-lg"
                    onPress={handleStartOver}
                  >
                    <Text className="text-sm font-sans-semibold text-primary-foreground">
                      {t('forgotPassword.sessionExpiredAction')}
                    </Text>
                  </Button>
                </View>
              ) : null}

              {/* Step 4: Success */}
              {activeStep === 4 && (
                <SuccessStepForgot onGoToLogin={handleGoToLogin} />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </>
  )
}
