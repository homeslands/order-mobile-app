# Auth Password UX Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cải thiện UX nhập mật khẩu trên tất cả màn auth — tạo `PasswordInputField` (show/hide only), redesign `PasswordRulesInput` (strength bar + rule tags), áp dụng đồng nhất trên 4 màn.

**Architecture:** Tạo `PasswordInputField` nhẹ cho các ô không cần rules (login, mật khẩu cũ, xác nhận). Redesign `PasswordRulesInput` thay bullet-list text bằng strength bar 3 segment + rule tag inline. Không thay đổi `usePasswordRules` hook, Zod schemas, hay phone input.

**Tech Stack:** React Native, NativeWind 4.2, lucide-react-native, React Hook Form Controller, TypeScript strict

---

## File Structure

| File                                        | Thay đổi                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `components/input/password-input-field.tsx` | TẠO MỚI — PasswordInputField component                                               |
| `components/input/index.tsx`                | Thêm export PasswordInputField                                                       |
| `components/input/password-rules-input.tsx` | Redesign UI — strength bar + tags                                                    |
| `components/auth/login-form.tsx`            | Thay manual show/hide → PasswordInputField                                           |
| `components/auth/register-form.tsx`         | Password → PasswordRulesInput (đã có), confirmPassword → PasswordInputField          |
| `components/form/reset-password-form.tsx`   | confirmPassword TextInput thuần → PasswordInputField                                 |
| `app/profile/change-password.tsx`           | oldPassword + confirmPassword → PasswordInputField, newPassword → PasswordRulesInput |

---

## Task 1: Tạo PasswordInputField component

**Files:**

- Create: `components/input/password-input-field.tsx`

- [ ] **Step 1: Tạo file với toàn bộ implementation**

```tsx
// components/input/password-input-field.tsx
import { Eye, EyeOff } from 'lucide-react-native'
import { useState } from 'react'
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'

import { colors } from '@/constants'
import { cn } from '@/lib/utils'

export interface PasswordInputFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  error?: string
}

export function PasswordInputField({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  error,
}: PasswordInputFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <View>
      <View className="relative">
        <TextInput
          className={cn(
            'h-10 rounded-lg border bg-white px-3 py-2 pr-10 text-base dark:bg-gray-800',
            'text-gray-900 dark:text-white',
            error
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-200 dark:border-gray-700',
          )}
          style={{ fontFamily: 'BeVietnamPro_400Regular' }}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? colors.mutedForeground.dark : colors.mutedForeground.light
          }
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!disabled}
        />
        <TouchableOpacity
          className="absolute bottom-0 right-3 top-0 justify-center"
          onPress={() => setShowPassword((v) => !v)}
          disabled={disabled}
          hitSlop={8}
        >
          {showPassword ? (
            <EyeOff size={20} color="#9ca3af" />
          ) : (
            <Eye size={20} color="#9ca3af" />
          )}
        </TouchableOpacity>
      </View>
      {!!error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
    </View>
  )
}
```

- [ ] **Step 2: Thêm export vào `components/input/index.tsx`**

Sửa `components/input/index.tsx` thành:

```tsx
export { default as CartNoteInput } from './cart-note-input'
export { NoteInput } from './note-input'
export { default as OrderNoteInput } from './order-note-input'
export { PasswordInputField } from './password-input-field'
export { PasswordRulesInput } from './password-rules-input'
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/input/password-input-field.tsx components/input/index.tsx
git commit -m "feat(auth): add PasswordInputField component with show/hide toggle"
```

---

## Task 2: Redesign PasswordRulesInput — strength bar + rule tags

**Files:**

- Modify: `components/input/password-rules-input.tsx`

**Context:** Thay bullet-list text bằng: (1) strength bar 3 segment màu, (2) rule tags hàng ngang với ✓/✗ prefix. Logic `touched` và `showRules` giữ nguyên — chỉ thay phần render bên dưới input.

Strength bar mapping dựa trên số rules met (`metCount`):

- 0 rules met: tất cả xám (trạng thái chưa nhập — không hiện vì `!touched`)
- 1 met: segment[0] đỏ, còn lại xám
- 2 met: segment[0-1] amber, segment[2] xám
- 3 met: tất cả xanh

- [ ] **Step 1: Viết lại toàn bộ file**

```tsx
// components/input/password-rules-input.tsx
import { Eye, EyeOff } from 'lucide-react-native'
import { useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'

import { usePasswordRules, type PasswordRules } from '@/hooks'
import { cn } from '@/lib/utils'

export interface PasswordRulesInputProps {
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rules?: PasswordRules
  strength?: string | null
  labels?: {
    minLength: string
    hasLetter: string
    hasNumber: string
    strength: string
  }
  showRules?: boolean
}

function segmentColor(index: number, metCount: number): string {
  if (index >= metCount) return 'bg-gray-200 dark:bg-gray-700'
  if (metCount === 1) return 'bg-red-500'
  if (metCount === 2) return 'bg-amber-500'
  return 'bg-green-500'
}

function strengthLabelColor(metCount: number): string {
  if (metCount === 1) return 'text-red-500'
  if (metCount === 2) return 'text-amber-500'
  return 'text-green-600 dark:text-green-400'
}

function RuleTag({ met, label }: { met: boolean; label: string }) {
  return (
    <View
      className={cn(
        'rounded-full px-2 py-0.5',
        met
          ? 'bg-green-100 dark:bg-green-900/40'
          : 'bg-gray-100 dark:bg-gray-800',
      )}
    >
      <Text
        className={cn(
          'text-xs font-medium',
          met
            ? 'text-green-700 dark:text-green-400'
            : 'text-gray-400 dark:text-gray-500',
        )}
      >
        {met ? '✓ ' : '✗ '}
        {label}
      </Text>
    </View>
  )
}

export function PasswordRulesInput({
  value,
  onChange,
  placeholder,
  disabled,
  rules: rulesProp,
  strength: strengthProp,
  labels: labelsProp,
  showRules = true,
}: PasswordRulesInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)

  const hookResult = usePasswordRules(value)
  const rules = rulesProp ?? hookResult.rules
  const strength = strengthProp ?? hookResult.strength
  const labels = labelsProp ?? hookResult.labels

  const metCount = [rules.minLength, rules.hasLetter, rules.hasNumber].filter(
    Boolean,
  ).length

  return (
    <View className="gap-2">
      {/* Input + toggle */}
      <View className="relative">
        <TextInput
          className={cn(
            'rounded-lg border bg-white px-4 py-3 pr-12 text-base text-gray-900 dark:bg-gray-800 dark:text-white',
            'border-gray-300 dark:border-gray-700',
            disabled && 'opacity-50',
          )}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={value}
          onChangeText={(text) => {
            onChange(text)
            if (!touched) setTouched(true)
          }}
          onBlur={() => setTouched(true)}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!disabled}
          style={{ fontFamily: 'BeVietnamPro_400Regular' }}
        />
        <TouchableOpacity
          className="absolute bottom-0 right-4 top-0 justify-center"
          onPress={() => setShowPassword(!showPassword)}
          disabled={disabled}
        >
          {showPassword ? (
            <EyeOff size={20} color="#999" />
          ) : (
            <Eye size={20} color="#999" />
          )}
        </TouchableOpacity>
      </View>

      {/* Strength bar + rule tags — chỉ hiện sau khi touched */}
      {showRules && touched && (
        <View className="gap-1.5">
          {/* Strength bar — 3 segments */}
          <View className="flex-row gap-1">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  segmentColor(i, metCount),
                )}
              />
            ))}
          </View>

          {/* Rule tags + strength label */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-wrap gap-1.5">
              <RuleTag met={rules.minLength} label={labels.minLength} />
              <RuleTag met={rules.hasLetter} label={labels.hasLetter} />
              <RuleTag met={rules.hasNumber} label={labels.hasNumber} />
            </View>
            {strength !== null && (
              <Text
                className={cn(
                  'ml-2 text-xs font-semibold',
                  strengthLabelColor(metCount),
                )}
              >
                {strength}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/input/password-rules-input.tsx
git commit -m "feat(auth): redesign PasswordRulesInput with strength bar and rule tags"
```

---

## Task 3: Update login-form — thay manual show/hide bằng PasswordInputField

**Files:**

- Modify: `components/auth/login-form.tsx`

**Context:** Hiện tại `login-form.tsx` dùng `FormInput` cho password + state `showPassword` + `TouchableOpacity` với Eye/EyeOff đặt absolute. Thay bằng `PasswordInputField` bọc trong `Controller`.

- [ ] **Step 1: Sửa `components/auth/login-form.tsx`**

Thay phần import và password field. File đầy đủ sau khi sửa:

```tsx
// components/auth/login-form.tsx
import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

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

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useZodForm(loginSchema, {
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
            const message =
              error instanceof Error ? error.message : 'Unknown error'
            showErrorToastMessage(message)
          }
        },
        onError: () => {},
      },
    )
  }

  const isLoading = isPending || isSubmitting

  return (
    <View className="flex-1 px-6 pt-12">
      <Text className="mb-2 font-sans-bold text-3xl text-foreground">
        {t('login.title')}
      </Text>
      <Text className="mb-8 font-sans text-base text-muted-foreground">
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
        labelClassName="text-md font-sans-medium text-muted-foreground"
      />

      {/* Password */}
      <View className="mb-6">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-md font-sans-medium text-muted-foreground">
            {t('login.password')}
          </Text>
          <TouchableOpacity
            onPress={() => navigateNative.push(ROUTE.FORGOT_PASSWORD)}
            disabled={isLoading}
            hitSlop={8}
          >
            <Text className="font-sans-semibold text-sm text-primary">
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

      {/* Submit */}
      <TouchableOpacity
        className="items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-primary-foreground">
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
        <Text className="font-sans text-sm text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Text className="font-sans-semibold text-primary">
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
        <Text className="font-sans text-sm text-muted-foreground">
          {t('login.goBackToHome')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-form.tsx
git commit -m "feat(auth): replace manual password show/hide in login with PasswordInputField"
```

---

## Task 4: Update register-form — confirmPassword → PasswordInputField

**Files:**

- Modify: `components/auth/register-form.tsx`

**Context:** Ô `password` đã dùng `FormInput` + show/hide thủ công — thay bằng `PasswordRulesInput` bọc trong `Controller` (đồng nhất với reset-password). Ô `confirmPassword` thay `FormInput` + show/hide thủ công → `PasswordInputField`.

- [ ] **Step 1: Sửa `components/auth/register-form.tsx`**

Thay phần imports và 2 ô password. File đầy đủ sau khi sửa:

```tsx
// components/auth/register-form.tsx
import dayjs from 'dayjs'
import { useCallback } from 'react'
import { Controller, useController } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

import { FormInput } from '@/components/form/form-input'
import { PasswordInputField } from '@/components/input'
import { PasswordRulesInput } from '@/components/input'
import { DobExpandablePicker } from '@/components/profile'
import { usePostAuthActions, useRegister, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { TRegisterSchema, useRegisterSchema } from '@/schemas'
import { showToast } from '@/utils'

const DEFAULT_DOB = dayjs().subtract(18, 'year').format('DD/MM/YYYY')

export default function RegisterForm() {
  const { t } = useTranslation('auth')
  const registerSchema = useRegisterSchema()

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, errors },
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
        onError: () => {},
      },
    )
  }

  const isLoading = isPending || isSubmitting

  return (
    <View className="flex-1 px-6 pt-8">
      <Text className="mb-2 font-sans-bold text-3xl text-foreground">
        {t('register.title')}
      </Text>
      <Text className="mb-8 font-sans text-base text-muted-foreground">
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
          <Text className="mt-1 text-xs text-destructive">
            {dobError.message}
          </Text>
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

      {/* Mật khẩu mới — PasswordRulesInput */}
      <View className="mb-4">
        <Text className="mb-1 text-xs text-muted-foreground">
          {t('register.password')}
        </Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <PasswordRulesInput
              value={value}
              onChange={onChange}
              placeholder={t('register.enterPassword')}
              disabled={isLoading}
            />
          )}
        />
        {errors.password && (
          <Text className="mt-1 text-xs text-destructive">
            {errors.password.message}
          </Text>
        )}
      </View>

      {/* Xác nhận mật khẩu — PasswordInputField */}
      <View className="mb-8">
        <Text className="mb-1 text-xs text-muted-foreground">
          {t('register.confirmPassword')}
        </Text>
        <Controller
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

      {/* Submit */}
      <TouchableOpacity
        className="mb-6 items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-primary-foreground">
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
        <Text className="font-sans text-sm text-muted-foreground">
          {t('register.haveAccount')}{' '}
          <Text className="font-sans-semibold text-primary">
            {t('register.login')}
          </Text>
        </Text>
      </TouchableOpacity>

      {/* Back to home */}
      <TouchableOpacity
        className="mb-8 items-center"
        onPress={() => navigateNative.replace('/(tabs)/home')}
        disabled={isLoading}
      >
        <Text className="font-sans text-sm text-muted-foreground">
          {t('register.goBackToHome')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/auth/register-form.tsx
git commit -m "feat(auth): use PasswordRulesInput and PasswordInputField in register form"
```

---

## Task 5: Update reset-password-form — confirmPassword → PasswordInputField

**Files:**

- Modify: `components/form/reset-password-form.tsx`

**Context:** Ô `confirmPassword` hiện dùng `TextInput` thuần bọc trong `View` + `TouchableOpacity` Eye/EyeOff tự quản lý. Thay bằng `PasswordInputField`. Bỏ `useState(showConfirmPassword)` và import `Eye`, `EyeOff`, `TextInput`.

- [ ] **Step 1: Sửa `components/form/reset-password-form.tsx`**

```tsx
// components/form/reset-password-form.tsx
import { useCallback } from 'react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'

import { PasswordInputField } from '@/components/input'
import { PasswordRulesInput } from '@/components/input'
import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { TResetPasswordSchema, useResetPasswordSchema } from '@/schemas'

interface ResetPasswordFormProps {
  onSubmit: (data: TResetPasswordSchema) => void
  isLoading?: boolean
  token: string
}

export function ResetPasswordForm({
  onSubmit,
  isLoading = false,
  token,
}: ResetPasswordFormProps) {
  const { t } = useTranslation('auth')

  const schema = useResetPasswordSchema()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useZodForm(schema, {
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
      token: token,
    },
  })

  const onFormSubmit = useCallback(
    (values: TResetPasswordSchema) => {
      onSubmit(values)
    },
    [onSubmit],
  )

  return (
    <View className="gap-4">
      {/* Mật khẩu mới */}
      <View>
        <Text className="mb-2 font-sans-medium text-sm text-foreground">
          {t('forgotPassword.newPassword')}
        </Text>
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, value } }) => (
            <PasswordRulesInput
              value={value}
              onChange={onChange}
              placeholder={t('forgotPassword.enterNewPassword')}
              disabled={isLoading}
            />
          )}
        />
        {errors.newPassword && (
          <Text className="mt-1 text-sm text-destructive">
            {errors.newPassword.message}
          </Text>
        )}
      </View>

      {/* Xác nhận mật khẩu — PasswordInputField thay TextInput thuần */}
      <View>
        <Text className="mb-2 font-sans-medium text-sm text-foreground">
          {t('forgotPassword.confirmNewPassword')}
        </Text>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordInputField
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={t('forgotPassword.enterConfirmNewPassword')}
              disabled={isLoading}
              error={errors.confirmPassword?.message}
            />
          )}
        />
      </View>

      <Button
        variant="primary"
        className="mt-2 h-11 rounded-lg"
        disabled={isLoading}
        onPress={handleSubmit(onFormSubmit)}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-sm text-primary-foreground">
            {t('forgotPassword.reset')}
          </Text>
        )}
      </Button>

      <Button
        variant="ghost"
        className="mt-2"
        disabled={isLoading}
        onPress={() => navigateNative.replace(ROUTE.LOGIN)}
      >
        <Text className="text-center font-sans-medium text-sm text-primary">
          Quay lại đăng nhập
        </Text>
      </Button>
    </View>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/form/reset-password-form.tsx
git commit -m "feat(auth): replace raw TextInput with PasswordInputField in reset-password confirm field"
```

---

## Task 6: Update change-password screen — thêm show/hide cho tất cả ô

**Files:**

- Modify: `app/profile/change-password.tsx`

**Context:** Màn này dùng `Input` thuần với `secureTextEntry` cố định — không có show/hide. Không dùng React Hook Form (state thủ công `useState`). Thay 3 ô:

- `oldPassword` → `PasswordInputField`
- `newPassword` → `PasswordRulesInput`
- `confirmPassword` → `PasswordInputField`

`PasswordRulesInput` không dùng RHF — truyền `value` và `onChange` trực tiếp từ state.

- [ ] **Step 1: Sửa `app/profile/change-password.tsx`**

```tsx
// app/profile/change-password.tsx
import { changePassword } from '@/api/profile'
import { Button } from '@/components/ui'
import { ScreenContainer } from '@/components/layout'
import { PasswordInputField, PasswordRulesInput } from '@/components/input'
import { colors } from '@/constants'
import { navigateNative } from '@/lib/navigation'
import { showToast } from '@/utils'
import { ArrowLeft } from 'lucide-react-native'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View, useColorScheme } from 'react-native'

function ChangePasswordScreen() {
  const { t } = useTranslation('profile')
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast(t('changePassword.fillRequired'))
      return
    }

    if (newPassword !== confirmPassword) {
      showToast(t('changePassword.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    changePassword({ oldPassword, newPassword })
      .then(() => {
        showToast(t('changePassword.success'))
        navigateNative.back()
      })
      .catch(() => {
        showToast(t('changePassword.error'))
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      className="flex-1 bg-gray-50 dark:bg-gray-900"
    >
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <Button
          variant="ghost"
          className="mr-2 h-10 min-h-0 w-10 items-center justify-center rounded-full px-0"
          onPress={() => navigateNative.back()}
        >
          <ArrowLeft
            size={22}
            color={
              isDark
                ? colors.mutedForeground.dark
                : colors.mutedForeground.light
            }
          />
        </Button>
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {t('changePassword.title')}
        </Text>
      </View>

      <View className="flex-1 px-4 py-6">
        <View className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {/* Mật khẩu cũ */}
          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('oldPassword')}
            </Text>
            <PasswordInputField
              value={oldPassword}
              onChange={setOldPassword}
              placeholder={t('enterOldPassword')}
              disabled={isSubmitting}
            />
          </View>

          {/* Mật khẩu mới — có strength bar + rules */}
          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('newPassword')}
            </Text>
            <PasswordRulesInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t('enterNewPassword')}
              disabled={isSubmitting}
            />
          </View>

          {/* Xác nhận mật khẩu */}
          <View className="mb-2">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('confirmPassword')}
            </Text>
            <PasswordInputField
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t('enterConfirmPassword')}
              disabled={isSubmitting}
            />
          </View>

          <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t('changePassword.passwordHint')}
          </Text>
        </View>

        <View className="mt-6">
          <Button
            className="h-11 w-full rounded-lg"
            style={{ backgroundColor: primaryColor }}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            <Text className="text-sm font-semibold text-white">
              {isSubmitting
                ? t('changePassword.updating')
                : t('changePassword.save')}
            </Text>
          </Button>
        </View>
      </View>
    </ScreenContainer>
  )
}

ChangePasswordScreen.displayName = 'ChangePasswordScreen'
export default React.memo(ChangePasswordScreen)
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run check
```

Expected: no errors, no warnings

- [ ] **Step 3: Commit**

```bash
git add app/profile/change-password.tsx
git commit -m "feat(auth): add show/hide toggle and password rules to change-password screen"
```

---

## Checklist hoàn thành

Sau khi xong 6 tasks, verify lại:

- [ ] `PasswordInputField` hiện Eye/EyeOff, tap toggle giữa ẩn/hiện
- [ ] `PasswordRulesInput` không hiện bar/tags khi chưa nhập ký tự nào
- [ ] Sau ký tự đầu: bar + tags xuất hiện, segment đỏ khi yếu
- [ ] Khi đủ 3 rules: 3 segment xanh, label "Mạnh" (hoặc i18n tương đương)
- [ ] Login: ô password có toggle, không có rules
- [ ] Register: ô password mới có rules, ô confirm chỉ có toggle
- [ ] Reset Password: ô mật khẩu mới có rules, ô confirm chỉ có toggle
- [ ] Change Password: ô mật khẩu cũ có toggle, ô mật khẩu mới có rules + toggle, ô confirm có toggle
- [ ] `npm run check` passes trên tất cả files đã sửa
