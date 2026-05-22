# OTP-Based Register Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-screen register with a 4-step OTP flow: Phone → OTP (alphanumeric, 10 min expiry, 2 min resend cooldown) → Password → Optional Profile.

**Architecture:** 4 Expo Router screens under `app/auth/register/`, sensitive state (phone, otp) passed via URL query params, no Zustand. After step 3 tokens are received and `handleAuthSuccess` is called; step 4 is an optional profile screen the user can skip.

**Tech Stack:** Expo Router, React Hook Form + Zod, TanStack Mutation, `OTPInput` (existing, `characterSet='alphanumeric'`), `PasswordRulesInput` (existing), `useAnimatedCountdown` (existing), `PASSWORD_REGEX` + `AuthRules` (existing constants).

---

## File Map

| Action | Path |
|--------|------|
| **Modify** | `types/user.type.ts` — rename conflicting type |
| **Modify** | `api/user.ts` — update type import |
| **Modify** | `api/auth.ts` — fix `completeRegistration` response type |
| **Modify** | `hooks/use-auth.ts` — remove `useRegister`, add 3 new hooks |
| **Modify** | `schemas/auth.schema.ts` — add `useRegisterPasswordSchema` |
| **Modify** | `i18n/vi/auth.json` — add new register keys |
| **Modify** | `i18n/en/auth.json` — add new register keys |
| **Delete** | `app/auth/register.tsx` |
| **Delete** | `components/auth/register-form.tsx` |
| **Create** | `components/auth/register-progress-bar.tsx` |
| **Create** | `app/auth/register/index.tsx` |
| **Create** | `components/auth/register-phone-form.tsx` |
| **Create** | `app/auth/register/otp.tsx` |
| **Create** | `components/auth/register-otp-step.tsx` |
| **Create** | `app/auth/register/password.tsx` |
| **Create** | `components/auth/register-password-form.tsx` |
| **Create** | `app/auth/register/profile.tsx` |
| **Create** | `components/auth/register-profile-form.tsx` |

---

## Task 1: Fix type conflict

`ICompleteRegistrationRequest` is exported from both `types/user.type.ts` and `types/auth.type.ts` — this causes a silent TypeScript ambiguity. The `user.type.ts` version (`slug + firstName + lastName + dob + address`) is used by `api/user.ts` for `PATCH /user/:slug/complete-registration` (a different endpoint). Rename it.

**Files:**
- Modify: `types/user.type.ts:188`
- Modify: `api/user.ts:5,251`

- [ ] **Step 1: Rename the type in `types/user.type.ts`**

Find line 188 (`export interface ICompleteRegistrationRequest {`) and rename to `ICompleteUserProfileRequest`:

```ts
export interface ICompleteUserProfileRequest {
  slug: string
  firstName: string
  lastName: string
  dob?: string
  address?: string
}
```

- [ ] **Step 2: Update `api/user.ts`**

Change import and usage:

```ts
// Line 5 — change:
import {
  ICompleteUserProfileRequest,  // was ICompleteRegistrationRequest
  ...
} from '@/types'

// Line 251 — change:
export async function completeRegistration(
  data: ICompleteUserProfileRequest,   // was ICompleteRegistrationRequest
): Promise<IApiResponse<IUserInfo>> {
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/user.type.ts api/user.ts
git commit -m "refactor(auth): rename ICompleteRegistrationRequest in user.type to ICompleteUserProfileRequest"
```

---

## Task 2: Fix `completeRegistration` response type

`api/auth.ts` currently declares `completeRegistration` returning `IApiResponse<{ isRegistered: boolean }>` but the actual API returns login tokens.

**Files:**
- Modify: `api/auth.ts:56-64`

- [ ] **Step 1: Update the function signature**

```ts
export async function completeRegistration(
  params: ICompleteRegistrationRequest,
): Promise<IApiResponse<ILoginResponse['result']>> {
  const response = await http.post<IApiResponse<ILoginResponse['result']>>(
    '/auth/register/complete',
    params,
  )
  return response.data
}
```

`ICompleteRegistrationRequest` here is the one from `auth.type.ts`: `{ phonenumber, otp, password, firstName?, lastName?, dob?, email? }`.

`ILoginResponse['result']` = `{ accessToken, expireTime, refreshToken, expireTimeRefreshToken }`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/auth.ts
git commit -m "fix(auth): correct completeRegistration response type to return login tokens"
```

---

## Task 3: Update `hooks/use-auth.ts`

Remove `useRegister` (only used in `register-form.tsx` which we delete). Add three new hooks for the OTP registration flow.

**Files:**
- Modify: `hooks/use-auth.ts`

- [ ] **Step 1: Update imports**

Remove `register` and `IRegisterRequest` from imports. Add the three new API functions and type:

```ts
import {
  completeRegistration,
  confirmEmailVerification,
  confirmForgotPassword,
  confirmPhoneNumberVerification,
  deleteAccount,
  initiateForgotPassword,
  initiateRegistration,
  login,
  resendEmailVerification,
  resendOTPForgotPassword,
  resendPhoneNumberVerification,
  resendRegistration,
  updateLanguage,
  uploadAvatar,
  verifyEmail,
  verifyOTPForgotPassword,
  verifyPhoneNumber,
} from '@/api'
import {
  ICompleteRegistrationRequest,
  IConfirmForgotPasswordRequest,
  IInitiateForgotPasswordRequest,
  ILoginRequest,
  IResendOTPForgotPasswordRequest,
  IVerifyEmailRequest,
  IVerifyOTPForgotPasswordRequest,
} from '@/types'
import { useMutation } from '@tanstack/react-query'
```

- [ ] **Step 2: Remove `useRegister`, add three new hooks**

Delete the `useRegister` block entirely. Add after `useLogin`:

```ts
export const useInitiateRegistration = () =>
  useMutation({
    mutationFn: (phonenumber: string) => initiateRegistration(phonenumber),
    meta: { skipGlobalError: true },
  })

export const useResendRegistration = () =>
  useMutation({
    mutationFn: (phonenumber: string) => resendRegistration(phonenumber),
    meta: { skipGlobalError: true },
  })

export const useCompleteRegistration = () =>
  useMutation({
    mutationFn: (params: ICompleteRegistrationRequest) =>
      completeRegistration(params),
    meta: { skipGlobalError: true },
  })
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-auth.ts
git commit -m "feat(auth): add useInitiateRegistration, useResendRegistration, useCompleteRegistration hooks"
```

---

## Task 4: Add password schema

**Files:**
- Modify: `schemas/auth.schema.ts`

- [ ] **Step 1: Add the schema and export type**

Append to the end of `schemas/auth.schema.ts`:

```ts
export function useRegisterPasswordSchema() {
  const { t } = useTranslation('auth')
  return z
    .object({
      password: z
        .string()
        .min(AuthRules.MIN_LENGTH, {
          message: t('register.minLength', { count: AuthRules.MIN_LENGTH }),
        })
        .regex(PASSWORD_REGEX, t('register.passwordInvalid')),
      confirmPassword: z
        .string()
        .min(1, t('register.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('register.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export type TRegisterPasswordSchema = z.infer<
  ReturnType<typeof useRegisterPasswordSchema>
>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add schemas/auth.schema.ts
git commit -m "feat(auth): add useRegisterPasswordSchema for OTP register flow"
```

---

## Task 5: Add i18n keys

New screens need new translation keys. Add them to both locale files.

**Files:**
- Modify: `i18n/vi/auth.json`
- Modify: `i18n/en/auth.json`

- [ ] **Step 1: Add keys to `i18n/vi/auth.json`**

Inside the `"register"` object, add these new keys (alongside existing ones):

```json
"next": "Tiếp theo",
"phoneAlreadyRegistered": "Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.",
"otpTitle": "Xác nhận OTP",
"otpSentTo": "Mã 6 ký tự đã gửi đến {{phone}}",
"otpExpiresIn": "Mã hết hạn sau",
"otpExpired": "Mã OTP đã hết hạn",
"verify": "Xác nhận",
"resend": "Gửi lại",
"resendIn": "Gửi lại ({{time}})",
"changePhone": "← Đổi số điện thoại",
"setPasswordTitle": "Đặt mật khẩu",
"setPasswordSubtitle": "Tối thiểu 8 ký tự, bao gồm chữ và số",
"createAccount": "Tạo tài khoản",
"otpInvalid": "Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
"profileTitle": "Hoàn thiện hồ sơ",
"profileSubtitle": "Bạn có thể bỏ qua và điền sau trong phần Cài đặt.",
"complete": "Hoàn thành",
"skip": "Bỏ qua"
```

- [ ] **Step 2: Add keys to `i18n/en/auth.json`**

Inside the `"register"` object:

```json
"next": "Next",
"phoneAlreadyRegistered": "This phone number is already registered. Please login.",
"otpTitle": "Confirm OTP",
"otpSentTo": "6-character code sent to {{phone}}",
"otpExpiresIn": "Code expires in",
"otpExpired": "OTP has expired",
"verify": "Verify",
"resend": "Resend",
"resendIn": "Resend ({{time}})",
"changePhone": "← Change phone number",
"setPasswordTitle": "Set password",
"setPasswordSubtitle": "At least 8 characters, including letters and numbers",
"createAccount": "Create account",
"otpInvalid": "OTP is invalid or expired. Please try again.",
"profileTitle": "Complete your profile",
"profileSubtitle": "You can skip this and fill in later in Settings.",
"complete": "Complete",
"skip": "Skip"
```

- [ ] **Step 3: Commit**

```bash
git add i18n/vi/auth.json i18n/en/auth.json
git commit -m "feat(i18n): add register OTP flow translation keys"
```

---

## Task 6: Shared progress bar + delete old files + Screen 1 (Phone)

Delete the old single-screen register files and create the new folder structure. The progress bar is used by all 4 screens so it lives in its own file.

**Files:**
- Delete: `app/auth/register.tsx`
- Delete: `components/auth/register-form.tsx`
- Create: `components/auth/register-progress-bar.tsx`
- Create: `app/auth/register/index.tsx`
- Create: `components/auth/register-phone-form.tsx`

- [ ] **Step 1: Delete old files**

```bash
git rm app/auth/register.tsx components/auth/register-form.tsx
```

- [ ] **Step 2: Create `components/auth/register-progress-bar.tsx`**

```tsx
import { cn } from '@/lib/utils'
import { View } from 'react-native'

export function RegisterProgressBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <View className="mb-6 flex-row gap-1">
      {([1, 2, 3, 4] as const).map((s) => (
        <View
          key={s}
          className={cn(
            'h-1 flex-1 rounded-full',
            s <= step ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700',
          )}
        />
      ))}
    </View>
  )
}
```

- [ ] **Step 3: Create `app/auth/register/index.tsx`**

```tsx
import { KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import RegisterPhoneForm from '@/components/auth/register-phone-form'

export default function RegisterPhoneScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  return (
    <ScreenContainer
      edges={['top']}
      className="flex-1"
      style={{ backgroundColor: bgColor }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ backgroundColor: bgColor }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RegisterPhoneForm />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
```

- [ ] **Step 4: Create `components/auth/register-phone-form.tsx`**

```tsx
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { RegisterProgressBar } from '@/components/auth/register-progress-bar'
import { FormInput } from '@/components/form/form-input'
import { PHONE_NUMBER_REGEX } from '@/constants'
import { useInitiateRegistration, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { showToast } from '@/utils'

const phoneSchema = z.object({
  phonenumber: z
    .string()
    .min(10)
    .max(10)
    .regex(PHONE_NUMBER_REGEX),
})

export default function RegisterPhoneForm() {
  const { t } = useTranslation('auth')

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useZodForm(phoneSchema, {
    mode: 'onTouched',
    defaultValues: { phonenumber: '' },
  })

  const { mutate, isPending } = useInitiateRegistration()
  const isLoading = isPending || isSubmitting

  const onSubmit = ({ phonenumber }: { phonenumber: string }) => {
    mutate(phonenumber, {
      onSuccess: (res) => {
        if (res.result?.isRegistered) {
          showToast(t('register.phoneAlreadyRegistered'))
          navigateNative.replace('/auth/login')
        } else {
          navigateNative.push(
            `/auth/register/otp?phone=${encodeURIComponent(phonenumber)}`,
          )
        }
      },
      onError: () => {},
    })
  }

  return (
    <View className="flex-1 px-6 pt-8">
      <RegisterProgressBar step={1} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.title')}
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.subtitle')}
      </Text>

      <FormInput
        control={control}
        name="phonenumber"
        label={t('register.phoneNumber')}
        placeholder={t('register.enterPhoneNumber')}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoComplete="tel"
        disabled={isLoading}
        required
        useTextInput
        transformOnChange={(v) => v.replace(/\D/g, '').slice(0, 10)}
      />

      <TouchableOpacity
        className="mb-6 mt-4 items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-white">
            {t('register.next')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="mb-8 items-center"
        onPress={() => navigateNative.replace('/auth/login')}
        disabled={isLoading}
      >
        <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
          {t('register.haveAccount')}{' '}
          <Text className="font-sans-semibold text-amber-500 dark:text-amber-400">
            {t('register.login')}
          </Text>
        </Text>
      </TouchableOpacity>
    </View>
  )
}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/auth/register-progress-bar.tsx app/auth/register/index.tsx components/auth/register-phone-form.tsx
git commit -m "feat(auth): add register phone screen (step 1/4)"
```

---

## Task 7: Screen 2 — OTP

**Files:**
- Create: `app/auth/register/otp.tsx`
- Create: `components/auth/register-otp-step.tsx`

The OTP step has **two independent timers:**
- `otpExpiresAt`: 10 min from mount, never resets on resend
- `resendAvailableAt`: 2 min from last send/resend, resets after each successful resend

Both use `useAnimatedCountdown` (Reanimated-based, runs on UI thread, no re-renders per second).

- [ ] **Step 1: Create `app/auth/register/otp.tsx`**

```tsx
import { KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import RegisterOtpStep from '@/components/auth/register-otp-step'

export default function RegisterOtpScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const { phone } = useLocalSearchParams<{ phone: string }>()

  return (
    <ScreenContainer
      edges={['top']}
      className="flex-1"
      style={{ backgroundColor: bgColor }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ backgroundColor: bgColor }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RegisterOtpStep phone={phone ?? ''} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
```

- [ ] **Step 2: Create `components/auth/register-otp-step.tsx`**

```tsx
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { AnimatedCountdownText } from '@/components/auth/animated-countdown-text'
import { OTPInput } from '@/components/auth/otp-input'
import { RegisterProgressBar } from '@/components/auth/register-progress-bar'
import { Button } from '@/components/ui'
import { useResendRegistration, useShakeAnimation } from '@/hooks'
import { useAnimatedCountdown } from '@/hooks/use-animated-countdown'
import { navigateNative } from '@/lib/navigation'

// Isolated component so only this re-renders each second (not the whole screen)
const ResendCooldownLabel = React.memo(function ResendCooldownLabel({
  countdownShared,
  label,
}: {
  countdownShared: ReturnType<typeof useAnimatedCountdown>
  label: string
}) {
  const [displayTime, setDisplayTime] = useState(() => {
    const s = Math.max(0, Math.floor(countdownShared.value))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })

  useAnimatedReaction(
    () => Math.floor(countdownShared.value),
    (current) => {
      if (current > 0) {
        const m = Math.floor(current / 60)
        const s = current % 60
        runOnJS(setDisplayTime)(`${m}:${String(s).padStart(2, '0')}`)
      }
    },
  )

  return (
    <Text className="font-sans-semibold text-sm text-gray-500 dark:text-gray-400">
      {label} ({displayTime})
    </Text>
  )
})

export default function RegisterOtpStep({ phone }: { phone: string }) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'

  const [otpValue, setOtpValue] = useState('')
  const [isOtpExpired, setIsOtpExpired] = useState(false)
  const [isResendAvailable, setIsResendAvailable] = useState(false)

  // OTP expiry — 10 min, never resets
  const [otpExpiresAt] = useState(
    () => new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  )

  // Resend cooldown — 2 min, resets after each resend
  const [resendAvailableAt, setResendAvailableAt] = useState(
    () => new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  )

  const otpExpiryShared = useAnimatedCountdown({ expiresAt: otpExpiresAt })
  const resendCooldownShared = useAnimatedCountdown({
    expiresAt: resendAvailableAt,
  })

  const { translateX, shake } = useShakeAnimation()

  // Detect OTP expiry (fires once when countdown hits 0)
  useAnimatedReaction(
    () => otpExpiryShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(setIsOtpExpired)(true)
      }
    },
  )

  // Detect resend cooldown end
  useAnimatedReaction(
    () => resendCooldownShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(setIsResendAvailable)(true)
      }
    },
  )

  const { mutate: resendMutate, isPending: isResending } =
    useResendRegistration()

  const handleResend = useCallback(() => {
    resendMutate(phone, {
      onSuccess: () => {
        setResendAvailableAt(
          new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        )
        setIsResendAvailable(false)
        setOtpValue('')
      },
      onError: () => {},
    })
  }, [phone, resendMutate])

  const handleVerify = useCallback(() => {
    if (otpValue.length < 6 || isOtpExpired) {
      shake()
      return
    }
    navigateNative.push(
      `/auth/register/password?phone=${encodeURIComponent(phone)}&otp=${encodeURIComponent(otpValue)}`,
    )
  }, [otpValue, isOtpExpired, phone, triggerShake])

  const isVerifyDisabled = otpValue.length < 6 || isResending || isOtpExpired
  const isResendDisabled = isResending || (!isResendAvailable && !isOtpExpired)

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View className="flex-1 px-6 pt-8">
      <RegisterProgressBar step={2} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.otpTitle')}
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.otpSentTo', { phone })}
      </Text>

      <Animated.View style={shakeStyle} className="mb-4">
        <OTPInput
          value={otpValue}
          onChange={setOtpValue}
          length={6}
          characterSet="alphanumeric"
          disabled={isOtpExpired || isResending}
        />
      </Animated.View>

      {!isOtpExpired ? (
        <AnimatedCountdownText
          countdownShared={otpExpiryShared}
          label={t('register.otpExpiresIn')}
          className="mb-4 text-center font-sans text-sm"
          isDark={isDark}
        />
      ) : (
        <Text className="mb-4 text-center font-sans text-sm text-red-500 dark:text-red-400">
          {t('register.otpExpired')}
        </Text>
      )}

      <Button
        variant="primary"
        className="mb-3 h-12 rounded-lg"
        disabled={isVerifyDisabled}
        onPress={handleVerify}
      >
        <Text className="font-sans-semibold text-base text-white">
          {t('register.verify')}
        </Text>
      </Button>

      <Button
        variant={isResendAvailable || isOtpExpired ? 'primary' : 'secondary'}
        className="mb-4 h-12 rounded-lg"
        disabled={isResendDisabled}
        onPress={handleResend}
      >
        {isResending ? (
          <ActivityIndicator
            color={isResendAvailable || isOtpExpired ? '#fff' : undefined}
          />
        ) : !isResendAvailable && !isOtpExpired ? (
          <ResendCooldownLabel
            countdownShared={resendCooldownShared}
            label={t('register.resend')}
          />
        ) : (
          <Text className="font-sans-semibold text-base text-white">
            {t('register.resend')}
          </Text>
        )}
      </Button>

      <TouchableOpacity
        className="items-center py-2"
        onPress={() => navigateNative.back()}
        disabled={isResending}
      >
        <Text className="font-sans-medium text-sm text-amber-500 dark:text-amber-400">
          {t('register.changePhone')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/auth/register/otp.tsx components/auth/register-otp-step.tsx
git commit -m "feat(auth): add register OTP screen (step 2/4)"
```

---

## Task 8: Screen 3 — Password

**Files:**
- Create: `app/auth/register/password.tsx`
- Create: `components/auth/register-password-form.tsx`

On success, `completeRegistration` returns `{ accessToken, refreshToken, expireTime, expireTimeRefreshToken }`. Pass to `handleAuthSuccess` then navigate to the profile screen.

On OTP error (server rejects the OTP code), show a toast and navigate back to the OTP screen so the user can request a fresh code.

- [ ] **Step 1: Create `app/auth/register/password.tsx`**

```tsx
import { KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import RegisterPasswordForm from '@/components/auth/register-password-form'

export default function RegisterPasswordScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const { phone, otp } = useLocalSearchParams<{ phone: string; otp: string }>()

  return (
    <ScreenContainer
      edges={['top']}
      className="flex-1"
      style={{ backgroundColor: bgColor }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ backgroundColor: bgColor }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RegisterPasswordForm phone={phone ?? ''} otp={otp ?? ''} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
```

- [ ] **Step 2: Create `components/auth/register-password-form.tsx`**

`Controller` here is from `react-hook-form`, not from `react-native`.

```tsx
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { Controller } from 'react-hook-form'

import { RegisterProgressBar } from '@/components/auth/register-progress-bar'
import { PasswordInputField, PasswordRulesInput } from '@/components/input'
import {
  useCompleteRegistration,
  usePostAuthActions,
  useZodForm,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import {
  useRegisterPasswordSchema,
  type TRegisterPasswordSchema,
} from '@/schemas'
import { showErrorToastMessage } from '@/utils'

export default function RegisterPasswordForm({
  phone,
  otp,
}: {
  phone: string
  otp: string
}) {
  const { t } = useTranslation('auth')
  const schema = useRegisterPasswordSchema()

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(schema, {
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  })

  const { mutate, isPending } = useCompleteRegistration()
  const { handleAuthSuccess } = usePostAuthActions()
  const isLoading = isPending || isSubmitting

  const onSubmit = useCallback(
    async ({ password }: TRegisterPasswordSchema) => {
      mutate(
        { phonenumber: phone, otp, password },
        {
          onSuccess: async (res) => {
            if (res.result) {
              await handleAuthSuccess(res.result)
              navigateNative.replace('/auth/register/profile')
            }
          },
          onError: (err: unknown) => {
            const status = (
              err as { response?: { status?: number } }
            )?.response?.status
            if (status === 400 || status === 422) {
              showErrorToastMessage(t('register.otpInvalid'))
              navigateNative.replace(
                `/auth/register/otp?phone=${encodeURIComponent(phone)}`,
              )
            }
          },
        },
      )
    },
    [phone, otp, mutate, handleAuthSuccess, t],
  )

  return (
    <View className="flex-1 px-6 pt-8">
      <RegisterProgressBar step={3} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.setPasswordTitle')}
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.setPasswordSubtitle')}
      </Text>

      <View className="mb-4">
        <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
          {t('register.password')}
          <Text className="text-red-500"> *</Text>
        </Text>
        <HookFormController
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordRulesInput
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={t('register.enterPassword')}
              disabled={isLoading}
            />
          )}
        />
        {errors.password && (
          <Text className="mt-1 text-xs text-red-500 dark:text-red-400">
            {errors.password.message}
          </Text>
        )}
      </View>

      <View className="mb-8">
        <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
          {t('register.confirmPassword')}
          <Text className="text-red-500"> *</Text>
        </Text>
        <HookFormController
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordInputField
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={t('register.enterConfirmPassword')}
              disabled={isLoading}
              error={errors.confirmPassword?.message}
            />
          )}
        />
      </View>

      <TouchableOpacity
        className="mb-6 items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-white">
            {t('register.createAccount')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. Fix any type errors before committing.

- [ ] **Step 4: Commit**

```bash
git add app/auth/register/password.tsx components/auth/register-password-form.tsx
git commit -m "feat(auth): add register password screen (step 3/4)"
```

---

## Task 9: Screen 4 — Optional Profile

**Files:**
- Create: `app/auth/register/profile.tsx`
- Create: `components/auth/register-profile-form.tsx`

The user is already logged in when they reach this screen (tokens stored in step 3). Profile update is best-effort: silent on failure, always navigates home.

- [ ] **Step 1: Create `app/auth/register/profile.tsx`**

```tsx
import { KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import RegisterProfileForm from '@/components/auth/register-profile-form'

export default function RegisterProfileScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  return (
    <ScreenContainer
      edges={['top']}
      className="flex-1"
      style={{ backgroundColor: bgColor }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ backgroundColor: bgColor }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RegisterProfileForm />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
```

- [ ] **Step 2: Create `components/auth/register-profile-form.tsx`**

```tsx
import dayjs from 'dayjs'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

import { updateProfile } from '@/api/profile'
import { RegisterProgressBar } from '@/components/auth/register-progress-bar'
import { FormInput } from '@/components/form/form-input'
import { DobExpandablePicker } from '@/components/profile'
import { useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import * as z from 'zod'
import { NAME_REGEX } from '@/constants'

const profileSchema = z.object({
  firstName: z
    .string()
    .max(100)
    .refine((val) => val === '' || NAME_REGEX.test(val)),
  lastName: z
    .string()
    .max(100)
    .refine((val) => val === '' || NAME_REGEX.test(val)),
  dob: z.string().optional(),
})

export default function RegisterProfileForm() {
  const { t } = useTranslation('auth')
  const [isLoading, setIsLoading] = useState(false)
  const [dobValue, setDobValue] = useState('')

  const { control, handleSubmit } = useZodForm(profileSchema, {
    mode: 'onTouched',
    defaultValues: { firstName: '', lastName: '', dob: '' },
  })

  const goHome = useCallback(
    () => navigateNative.replace('/(tabs)/home'),
    [],
  )

  const onSubmit = useCallback(
    async ({ firstName, lastName }: z.infer<typeof profileSchema>) => {
      setIsLoading(true)
      try {
        await updateProfile({
          firstName: firstName || null,
          lastName: lastName || null,
          dob: dobValue || null,
        })
      } catch {
        // silent — always navigate home
      } finally {
        setIsLoading(false)
        goHome()
      }
    },
    [dobValue, goHome],
  )

  const handleDobSelect = useCallback((date: string) => {
    const d = dayjs(date)
    if (d.isValid()) setDobValue(d.format('DD/MM/YYYY'))
  }, [])

  return (
    <View className="flex-1 px-6 pt-8">
      <RegisterProgressBar step={4} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.profileTitle')} 🎉
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.profileSubtitle')}
      </Text>

      <FormInput
        control={control}
        name="lastName"
        label={t('register.lastName')}
        placeholder={t('register.enterLastName')}
        autoCapitalize="words"
        disabled={isLoading}
        optional
        useTextInput
      />

      <FormInput
        control={control}
        name="firstName"
        label={t('register.firstName')}
        placeholder={t('register.enterFirstName')}
        autoCapitalize="words"
        disabled={isLoading}
        optional
        useTextInput
      />

      <View className="mb-4">
        <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
          {t('register.dob')}
        </Text>
        <DobExpandablePicker
          value={dobValue}
          onSelect={handleDobSelect}
          placeholder={t('register.selectDob')}
        />
      </View>

      <TouchableOpacity
        className="mb-3 items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-white">
            {t('register.complete')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="mb-8 items-center py-2"
        onPress={goHome}
        disabled={isLoading}
      >
        <Text className="font-sans-semibold text-sm text-amber-500 dark:text-amber-400">
          {t('register.skip')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/auth/register/profile.tsx components/auth/register-profile-form.tsx
git commit -m "feat(auth): add register optional profile screen (step 4/4)"
```

---

## Task 10: Final check

- [ ] **Step 1: Full typecheck + lint**

```bash
npm run check
```

Expected: no errors, no warnings.

- [ ] **Step 2: Verify route resolution**

Check that Expo Router correctly resolves the new routes. The auth layout (`app/auth/_layout.tsx`) uses `CustomStack` — it automatically picks up all screens inside `app/auth/` including the new `register/` subfolder. No changes needed to `_layout.tsx`.

Verify the old route (`/auth/register`) still works — it now points to `app/auth/register/index.tsx`. Any existing `navigateNative.replace('/auth/register')` or links to `/auth/register` remain valid.

- [ ] **Step 3: Verify `components/auth` exports (if there is an index)**

```bash
grep -n "register-form\|register-phone\|register-otp\|register-password\|register-profile\|register-progress" components/auth/index.ts 2>/dev/null
```

If `components/auth/index.ts` exists and re-exports auth components, add the new ones. If not, imports are done by direct path (already done in the code above).

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(auth): complete OTP-based register flow (4-step with progress bar)"
```
