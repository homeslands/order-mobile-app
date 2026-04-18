import { useQueryClient } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronLeft } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AnimatedCountdownText, OTPInput } from '@/components/auth'
import { FormInput } from '@/components/form'
import { Button, Skeleton } from '@/components/ui'
import { QUERYKEY, colors } from '@/constants'
import { FOOTER_BOTTOM_EXTRA, STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'
import {
  useAnimatedCountdown,
  useConfirmEmailVerification,
  useCountdown,
  useFormatTime,
  useProfile,
  useResendEmailVerification,
  useScreenTransition,
  useVerifyEmail,
  useZodForm,
} from '@/hooks'
import { verifyEmailSchema, type TVerifyEmailSchema } from '@/schemas'
import { useAuthStore, useUserStore } from '@/stores'
import { showErrorToast, showToast } from '@/utils'

function applyOtpBuffer(expiresAt: string): string {
  const expiresMs = new Date(expiresAt).getTime()
  const remainingMs = expiresMs - Date.now()
  if (remainingMs <= 30_000) return expiresAt
  return new Date(expiresMs - 30_000).toISOString()
}

type TVerifyEmailFormSchema = Pick<TVerifyEmailSchema, 'email'>
const verifyEmailFormSchema = verifyEmailSchema.pick({ email: true })

const HEADER_FADE_DISTANCE = 60

const VerifyEmailHeader = React.memo(function VerifyEmailHeader({
  title,
  onBack,
  isDark,
  scrollY,
}: {
  title: string
  onBack: () => void
  isDark: boolean
  scrollY: SharedValue<number>
}) {
  const pageBg = isDark ? colors.background.dark : colors.background.light
  const gradientColors = useMemo(
    () => [`${pageBg}F0`, `${pageBg}AA`, `${pageBg}00`] as const,
    [pageBg],
  )
  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_FADE_DISTANCE],
      [0.6, 1],
      'clamp',
    ),
  }))

  return (
    <View style={headerStyles.container} pointerEvents="box-none">
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[headerStyles.row, { paddingTop: STATIC_TOP_INSET + 10 }]}
        pointerEvents="auto"
      >
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={[
            headerStyles.circleBtn,
            { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
            headerStyles.shadow,
          ]}
        >
          <ChevronLeft
            size={20}
            color={isDark ? colors.gray[50] : colors.gray[900]}
          />
        </Pressable>
        <Animated.Text
          style={[
            headerStyles.title,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
            titleAnimStyle,
          ]}
          numberOfLines={1}
        >
          {title}
        </Animated.Text>
        <View style={headerStyles.circleBtn} />
      </View>
    </View>
  )
})

const headerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
})

const OTPStepEmail = React.memo(function OTPStepEmail({
  expiresAt,
  otp,
  onOtpChange,
  isResending,
  isConfirming,
  onResend,
  onBack,
  onExpired,
  isDark,
}: {
  expiresAt: string
  otp: string
  onOtpChange: (v: string) => void
  isResending: boolean
  isConfirming: boolean
  onResend: () => void
  onBack: () => void
  onExpired: () => void
  isDark: boolean
}) {
  const { t } = useTranslation('profile')

  const otpSeconds = useCountdown({ expiresAt, enabled: true })
  const otpTimeDisplay = useFormatTime(otpSeconds)
  const otpShared = useAnimatedCountdown({ expiresAt, enabled: true })
  const otpExpired = otpSeconds === 0
  const canResend = otpSeconds <= 0

  useEffect(() => {
    if (otpExpired) onExpired()
  }, [otpExpired, onExpired])

  return (
    <>
      <OTPInput
        value={otp}
        onChange={onOtpChange}
        characterSet="alphanumeric"
        disabled={otpExpired}
      />
      {!otpExpired && (
        <Text
          style={{
            fontSize: 12,
            color: isDark ? colors.gray[400] : colors.gray[500],
          }}
        >
          {t('profile.verifyEmailScreen.otpHint')}
        </Text>
      )}
      {!otpExpired ? (
        <AnimatedCountdownText
          countdownShared={otpShared}
          label={t('profile.otpExpiredIn')}
          className="text-center font-sans text-sm"
          isDark={isDark}
        />
      ) : (
        <Text className="text-center font-sans text-sm text-destructive">
          {t('profile.verifyPhone.otpExpired')}
        </Text>
      )}
      <Button
        variant={otpExpired ? 'primary' : 'secondary'}
        className="h-11 rounded-lg"
        disabled={isResending || isConfirming || !canResend}
        onPress={onResend}
      >
        {isResending ? (
          <ActivityIndicator color={otpExpired ? '#fff' : undefined} />
        ) : (
          <Text
            className={`font-sans-semibold text-sm ${
              !canResend
                ? 'text-muted-foreground'
                : otpExpired
                  ? 'text-primary-foreground'
                  : 'text-foreground'
            }`}
          >
            {otpSeconds > 0
              ? `${t('profile.verifyEmailScreen.button.resend')} (${otpTimeDisplay})`
              : t('profile.verifyEmailScreen.button.resend')}
          </Text>
        )}
      </Button>
      <TouchableOpacity onPress={onBack} className="py-2">
        <Text className="text-center font-sans-medium text-sm text-primary">
          {t('profile.verifyEmailScreen.backToEdit')}
        </Text>
      </TouchableOpacity>
    </>
  )
})

const VerifyEmailSkeleton = React.memo(function VerifyEmailSkeleton() {
  const isDark = useColorScheme() === 'dark'
  const scrollY = useSharedValue(0)
  const { t } = useTranslation('profile')

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark
          ? colors.background.dark
          : colors.background.light,
      }}
    >
      <VerifyEmailHeader
        title={t('profile.verifyEmailScreen.title')}
        onBack={() => navigateNative.back()}
        isDark={isDark}
        scrollY={scrollY}
      />
      <View style={{ padding: 24, paddingTop: STATIC_TOP_INSET + 72, gap: 16 }}>
        <Skeleton style={{ height: 32, width: 200, borderRadius: 8 }} />
        <Skeleton style={{ height: 20, borderRadius: 6 }} />
        <Skeleton style={{ height: 56, borderRadius: 12 }} />
        <Skeleton style={{ height: 44, borderRadius: 10 }} />
      </View>
    </View>
  )
})

function VerifyEmailContent() {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const scrollY = useSharedValue(0)

  const token = useAuthStore((s) => s.token)
  const userInfo = useUserStore((s) => s.userInfo)
  const emailVerificationStatus = useUserStore((s) => s.emailVerificationStatus)
  const setEmailVerificationStatus = useUserStore(
    (s) => s.setEmailVerificationStatus,
  )
  const setUserInfo = useUserStore((s) => s.setUserInfo)

  const [otp, setOtp] = useState('')
  const [otpExpired, setOtpExpired] = useState(false)

  const expiresAt = emailVerificationStatus?.expiresAt
  const showOtpStep = !!expiresAt

  const { control, handleSubmit, reset } = useZodForm<TVerifyEmailFormSchema>(
    verifyEmailFormSchema,
    {
      defaultValues: { email: userInfo?.email ?? '' },
      mode: 'onSubmit',
      reValidateMode: 'onBlur',
    },
  )

  useEffect(() => {
    if (!userInfo) navigateNative.back()
  }, [userInfo])

  // Clear persisted OTP status if already expired when screen mounts
  useEffect(() => {
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      setEmailVerificationStatus(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reset({ email: userInfo?.email ?? '' })
  }, [userInfo?.email, reset])

  // Reset otpExpired when OTP step changes
  useEffect(() => {
    if (!showOtpStep) setOtpExpired(false)
  }, [showOtpStep])

  const { refetch: refetchProfile } = useProfile()
  const { mutate: verifyEmail, isPending: isSending } = useVerifyEmail()
  const { mutate: confirmOtp, isPending: isConfirming } =
    useConfirmEmailVerification()
  const { mutate: resendOtp, isPending: isResending } =
    useResendEmailVerification()

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollY.value = e.nativeEvent.contentOffset.y
    },
    // SharedValue is a stable ref — does not need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const handleBack = useCallback(() => {
    if (showOtpStep) {
      setEmailVerificationStatus(null)
      setOtp('')
    } else {
      navigateNative.back()
    }
  }, [showOtpStep, setEmailVerificationStatus])

  const handleResendOtp = useCallback(() => {
    resendOtp(undefined, {
      onSuccess: (res) => {
        setOtp('')
        setEmailVerificationStatus({
          expiresAt: applyOtpBuffer(res.result.expiresAt),
          slug: res.result.slug,
        })
        showToast(t('profile.verifyEmailScreen.toast.resendSuccess'))
      },
      onError: (err: unknown) => {
        const code =
          (
            err as {
              response?: { data?: { code?: number; statusCode?: number } }
            }
          )?.response?.data?.code ??
          (
            err as {
              response?: { data?: { code?: number; statusCode?: number } }
            }
          )?.response?.data?.statusCode
        if (typeof code === 'number') showErrorToast(code)
        else showToast(t('profile.verifyEmailFailed'), tCommon('common.error'))
      },
    })
  }, [resendOtp, setEmailVerificationStatus, t, tCommon])

  const handleSendEmail = useCallback(
    ({ email }: TVerifyEmailFormSchema) => {
      if (!token) {
        navigateNative.back()
        return
      }
      verifyEmail(
        { email, accessToken: token },
        {
          onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: [QUERYKEY.profile] })
            setEmailVerificationStatus({
              expiresAt: applyOtpBuffer(res.result.expiresAt),
              slug: res.result.slug,
            })
            showToast(t('profile.verifyEmailScreen.toast.sent'))
          },
          onError: (err: unknown) => {
            const code =
              (
                err as {
                  response?: { data?: { code?: number; statusCode?: number } }
                }
              )?.response?.data?.code ??
              (
                err as {
                  response?: { data?: { code?: number; statusCode?: number } }
                }
              )?.response?.data?.statusCode
            if (code === 119017) {
              // Token already exists — resend to get a fresh expiresAt and show OTP step
              resendOtp(undefined, {
                onSuccess: (res) => {
                  setEmailVerificationStatus({
                    expiresAt: applyOtpBuffer(res.result.expiresAt),
                    slug: res.result.slug,
                  })
                  setOtp('')
                  showToast(t('profile.verifyEmailScreen.toast.resendSuccess'))
                },
                onError: (resendErr: unknown) => {
                  const resendCode =
                    (
                      resendErr as {
                        response?: {
                          data?: { code?: number; statusCode?: number }
                        }
                      }
                    )?.response?.data?.code ??
                    (
                      resendErr as {
                        response?: {
                          data?: { code?: number; statusCode?: number }
                        }
                      }
                    )?.response?.data?.statusCode
                  if (typeof resendCode === 'number') showErrorToast(resendCode)
                  else
                    showToast(
                      t('profile.verifyEmailFailed'),
                      tCommon('common.error'),
                    )
                },
              })
            } else if (typeof code === 'number') {
              showErrorToast(code)
            } else {
              showToast(t('profile.verifyEmailFailed'), tCommon('common.error'))
            }
          },
        },
      )
    },
    [
      token,
      verifyEmail,
      resendOtp,
      queryClient,
      setEmailVerificationStatus,
      t,
      tCommon,
    ],
  )

  const handleVerifyOtp = useCallback(() => {
    const normalizedOtp = otp.toUpperCase()
    if (normalizedOtp.length !== 6) return
    confirmOtp(normalizedOtp, {
      onSuccess: () => {
        setEmailVerificationStatus(null)
        refetchProfile()
          .then(({ data }) => {
            if (data?.result) setUserInfo(data.result)
          })
          .catch(() => {
            queryClient.invalidateQueries({ queryKey: [QUERYKEY.profile] })
          })
        showToast(t('profile.verifyEmailSuccessfully'))
        navigateNative.back()
      },
      onError: () => {
        setOtp('')
      },
    })
  }, [
    otp,
    confirmOtp,
    setEmailVerificationStatus,
    refetchProfile,
    setUserInfo,
    queryClient,
    t,
  ])

  const handleOtpChange = useCallback((v: string) => setOtp(v), [])

  const handleExpired = useCallback(() => setOtpExpired(true), [])

  const headerTitle = useMemo(
    () =>
      showOtpStep
        ? t('profile.verifyEmailScreen.otpInputTitle')
        : t('profile.verifyEmailScreen.title'),
    [showOtpStep, t],
  )

  if (!userInfo) return null

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark
          ? colors.background.dark
          : colors.background.light,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={handleScroll}
        contentContainerStyle={{
          paddingTop: STATIC_TOP_INSET + 72,
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 16,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            color: isDark ? colors.gray[400] : colors.gray[500],
            marginBottom: 8,
          }}
        >
          {showOtpStep
            ? t('profile.verifyEmailScreen.description.otp')
            : t('profile.verifyEmailScreen.description.email')}
        </Text>

        {!showOtpStep ? (
          <FormInput
            control={control}
            name="email"
            label={t('profile.verifyEmailScreen.label.email')}
            keyboardType="email-address"
          />
        ) : (
          <OTPStepEmail
            expiresAt={expiresAt}
            otp={otp}
            onOtpChange={handleOtpChange}
            isResending={isResending}
            isConfirming={isConfirming}
            onResend={handleResendOtp}
            onBack={handleBack}
            onExpired={handleExpired}
            isDark={isDark}
          />
        )}
      </ScrollView>

      {/* Footer — confirm button */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + FOOTER_BOTTOM_EXTRA,
          paddingTop: 12,
          backgroundColor: isDark
            ? colors.background.dark
            : colors.background.light,
        }}
      >
        <Button
          variant="primary"
          className="h-11 rounded-lg"
          disabled={
            showOtpStep
              ? isConfirming || otp.length !== 6 || otpExpired
              : isSending || isResending
          }
          onPress={
            showOtpStep ? handleVerifyOtp : handleSubmit(handleSendEmail)
          }
        >
          {isConfirming || isSending || isResending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-sans-semibold text-sm text-primary-foreground">
              {showOtpStep
                ? t('profile.verifyEmailScreen.button.verify')
                : t('profile.verifyEmailScreen.button.send')}
            </Text>
          )}
        </Button>
      </View>

      <VerifyEmailHeader
        title={headerTitle}
        onBack={handleBack}
        isDark={isDark}
        scrollY={scrollY}
      />
    </View>
  )
}

function VerifyEmailScreen() {
  const { isTransitionComplete } = useScreenTransition()
  if (!isTransitionComplete) return <VerifyEmailSkeleton />
  return <VerifyEmailContent />
}

VerifyEmailScreen.displayName = 'VerifyEmailScreen'
export default React.memo(VerifyEmailScreen)
