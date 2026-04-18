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
import { Button, Skeleton } from '@/components/ui'
import { QUERYKEY, colors } from '@/constants'
import { FOOTER_BOTTOM_EXTRA, STATIC_TOP_INSET } from '@/constants/status-bar'
import {
  useAnimatedCountdown,
  useConfirmPhoneNumberVerification,
  useCountdown,
  useFormatTime,
  useResendPhoneNumberVerification,
  useScreenTransition,
  useVerifyPhoneNumber,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import { showErrorToast, showToast } from '@/utils'

function applyOtpBuffer(expiresAt: string): string {
  const expiresMs = new Date(expiresAt).getTime()
  const remainingMs = expiresMs - Date.now()
  if (remainingMs <= 30_000) return expiresAt
  return new Date(expiresMs - 30_000).toISOString()
}

const HEADER_FADE_DISTANCE = 60

const VerifyPhoneHeader = React.memo(function VerifyPhoneHeader({
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

const PhoneNumberCard = React.memo(function PhoneNumberCard({
  phonenumber,
  isDark,
}: {
  phonenumber: string
  isDark: boolean
}) {
  const { t } = useTranslation('profile')
  return (
    <View
      style={{
        backgroundColor: isDark ? colors.gray[800] : colors.gray[100],
        borderRadius: 12,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: isDark ? colors.gray[400] : colors.gray[500],
          marginBottom: 2,
          paddingHorizontal: 16,
        }}
      >
        {t('profile.verifyPhone.smsWillBeSentTo')}
      </Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: isDark ? colors.gray[50] : colors.gray[900],
          paddingHorizontal: 16,
        }}
      >
        {phonenumber}
      </Text>
    </View>
  )
})

const OTPStepPhone = React.memo(function OTPStepPhone({
  expiresAt,
  otpValue,
  onOtpChange,
  isResending,
  isConfirming,
  onResend,
  onBack,
  onExpired,
  isDark,
}: {
  expiresAt: string
  otpValue: string
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

  useEffect(() => {
    if (otpExpired) onExpired()
  }, [otpExpired, onExpired])

  const isResendDisabled = isResending || isConfirming || otpSeconds > 0

  return (
    <>
      <OTPInput
        value={otpValue}
        onChange={onOtpChange}
        characterSet="numeric"
        disabled={otpExpired}
      />

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
        disabled={isResendDisabled}
        onPress={onResend}
      >
        {isResending ? (
          <ActivityIndicator color={otpExpired ? '#fff' : undefined} />
        ) : (
          <Text
            className={`font-sans-semibold text-sm ${
              isResendDisabled
                ? 'text-muted-foreground'
                : otpExpired
                  ? 'text-primary-foreground'
                  : 'text-foreground'
            }`}
          >
            {otpSeconds > 0
              ? `${t('profile.resendVerificationPhoneNumber')} (${otpTimeDisplay})`
              : t('profile.resendVerificationPhoneNumber')}
          </Text>
        )}
      </Button>

      <TouchableOpacity onPress={onBack} className="py-2">
        <Text className="text-center font-sans-medium text-sm text-primary">
          {t('profile.verifyPhone.backToEdit')}
        </Text>
      </TouchableOpacity>
    </>
  )
})

const VerifyPhoneNumberSkeleton = React.memo(
  function VerifyPhoneNumberSkeleton() {
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
        <VerifyPhoneHeader
          title={t('profile.verifyPhone.title')}
          onBack={() => navigateNative.back()}
          isDark={isDark}
          scrollY={scrollY}
        />
        <View
          style={{ padding: 24, paddingTop: STATIC_TOP_INSET + 72, gap: 16 }}
        >
          <Skeleton style={{ height: 56, borderRadius: 12 }} />
          <Skeleton style={{ height: 44, borderRadius: 10 }} />
        </View>
      </View>
    )
  },
)

function VerifyPhoneNumberContent() {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const scrollY = useSharedValue(0)

  const userInfo = useUserStore((s) => s.userInfo)
  const phoneNumberVerificationStatus = useUserStore(
    (s) => s.phoneNumberVerificationStatus,
  )
  const setPhoneNumberVerificationStatus = useUserStore(
    (s) => s.setPhoneNumberVerificationStatus,
  )

  const [otpValue, setOtpValue] = useState('')
  const [otpExpired, setOtpExpired] = useState(false)

  const expiresAt = phoneNumberVerificationStatus?.expiresAt
  const showOtpStep = !!expiresAt

  const { mutate: verifyPhoneNumber, isPending: isSending } =
    useVerifyPhoneNumber()
  const { mutate: confirmPhoneNumberVerification, isPending: isConfirming } =
    useConfirmPhoneNumberVerification()
  const { mutate: resendPhoneNumberVerification, isPending: isResending } =
    useResendPhoneNumberVerification()

  useEffect(() => {
    if (!userInfo || !userInfo.phonenumber) navigateNative.back()
  }, [userInfo])

  // Clear persisted OTP status if already expired when screen mounts
  useEffect(() => {
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      setPhoneNumberVerificationStatus(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset otpExpired when OTP step changes
  useEffect(() => {
    if (!showOtpStep) setOtpExpired(false)
  }, [showOtpStep])

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
      setPhoneNumberVerificationStatus(null)
      setOtpValue('')
    } else {
      navigateNative.back()
    }
  }, [showOtpStep, setPhoneNumberVerificationStatus])

  const handleSendCode = useCallback(() => {
    verifyPhoneNumber(undefined, {
      onSuccess: (response) => {
        queryClient.invalidateQueries({
          queryKey: [QUERYKEY.profile],
          exact: true,
        })
        setPhoneNumberVerificationStatus({
          expiresAt: applyOtpBuffer(response.result.expiresAt),
        })
        setOtpValue('')
        showToast(t('profile.verifyPhone.otpSent'))
      },
      onError: (err: unknown) => {
        const code = (err as { response?: { data?: { statusCode?: number } } })
          ?.response?.data?.statusCode
        if (code === 119027) {
          // Token already exists — resend to get a fresh expiresAt and show OTP step
          resendPhoneNumberVerification(undefined, {
            onSuccess: (response) => {
              setPhoneNumberVerificationStatus({
                expiresAt: applyOtpBuffer(response.result.expiresAt),
              })
              setOtpValue('')
              showToast(t('profile.verifyPhone.otpResent'))
            },
          })
        } else if (typeof code === 'number') {
          showErrorToast(code)
        } else {
          showToast(
            t('profile.verifyPhone.sendFailed'),
            tCommon('common.error'),
          )
        }
      },
    })
  }, [
    verifyPhoneNumber,
    resendPhoneNumberVerification,
    queryClient,
    setPhoneNumberVerificationStatus,
    t,
    tCommon,
  ])

  const handleVerifyOtp = useCallback(() => {
    if (otpValue.length !== 6) return
    confirmPhoneNumberVerification(otpValue, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [QUERYKEY.profile],
          exact: true,
        })
        showToast(t('profile.verifyPhone.success'))
        setPhoneNumberVerificationStatus(null)
        setOtpValue('')
        navigateNative.back()
      },
      onError: () => {
        setOtpValue('')
      },
    })
  }, [
    otpValue,
    confirmPhoneNumberVerification,
    queryClient,
    setPhoneNumberVerificationStatus,
    t,
  ])

  const handleResendOtp = useCallback(() => {
    resendPhoneNumberVerification(undefined, {
      onSuccess: (response) => {
        setPhoneNumberVerificationStatus({
          expiresAt: applyOtpBuffer(response.result.expiresAt),
        })
        setOtpValue('')
        showToast(t('profile.verifyPhone.otpResent'))
      },
    })
  }, [resendPhoneNumberVerification, setPhoneNumberVerificationStatus, t])

  const handleOtpChange = useCallback((v: string) => setOtpValue(v), [])

  const handleExpired = useCallback(() => setOtpExpired(true), [])

  const headerTitle = useMemo(
    () =>
      showOtpStep
        ? t('profile.verifyPhone.otpInputTitle')
        : t('profile.verifyPhone.title'),
    [showOtpStep, t],
  )

  if (!userInfo || !userInfo.phonenumber) return null

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
          }}
        >
          {showOtpStep
            ? t('profile.verifyPhone.enterOtp')
            : t('profile.verifyPhone.description')}
        </Text>

        {!showOtpStep ? (
          <PhoneNumberCard phonenumber={userInfo.phonenumber} isDark={isDark} />
        ) : (
          <OTPStepPhone
            expiresAt={expiresAt}
            otpValue={otpValue}
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
              ? isConfirming || otpValue.length !== 6 || otpExpired
              : isSending || isResending
          }
          onPress={showOtpStep ? handleVerifyOtp : handleSendCode}
        >
          {isConfirming || isSending || isResending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-sans-semibold text-sm text-primary-foreground">
              {showOtpStep
                ? t('profile.verify')
                : t('profile.sendVerifyPhoneNumber')}
            </Text>
          )}
        </Button>
      </View>

      <VerifyPhoneHeader
        title={headerTitle}
        onBack={handleBack}
        isDark={isDark}
        scrollY={scrollY}
      />
    </View>
  )
}

function VerifyPhoneNumberScreen() {
  const { isTransitionComplete } = useScreenTransition()
  if (!isTransitionComplete) return <VerifyPhoneNumberSkeleton />
  return <VerifyPhoneNumberContent />
}

VerifyPhoneNumberScreen.displayName = 'VerifyPhoneNumberScreen'
export default React.memo(VerifyPhoneNumberScreen)
