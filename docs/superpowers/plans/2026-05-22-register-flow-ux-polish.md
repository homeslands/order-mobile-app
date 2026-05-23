# Register Flow UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UX gaps in the 4-step OTP register flow: missing toast feedback, a silent-failure in profile update, a state-staleness bug in OTP countdown, and a misleading "Đổi SĐT" flow that needs a confirmation dialog.

**Architecture:** All changes are contained in 5 files (`register-otp-step.tsx`, `register-phone-form.tsx`, `register-password-form.tsx`, `register-profile-form.tsx`) plus i18n JSONs. No new components are needed — `ConfirmationDialog` (already in codebase at `@/components/dialog/confirmation-dialog`) handles the warning dialogs. Toast calls use existing `showToast` / `showErrorToastMessage` from `@/utils`.

**Tech Stack:** React Native, `ConfirmationDialog` (`@/components/dialog/confirmation-dialog`), `showToast` / `showErrorToastMessage` (`@/utils`), `navigateNative` (`@/lib/navigation`), react-i18next.

---

## File Map

| Action     | Path                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| **Modify** | `i18n/vi/auth.json` — add 9 new register keys                                                            |
| **Modify** | `i18n/en/auth.json` — add 9 new register keys                                                            |
| **Modify** | `components/auth/register-otp-step.tsx` — fix `otpExpiresAt` bug, resend feedback, back confirm dialog   |
| **Modify** | `components/auth/register-phone-form.tsx` — add OTP-sent success toast                                   |
| **Modify** | `components/auth/register-password-form.tsx` — add confirm dialog for "Đổi SĐT" + register success toast |
| **Modify** | `components/auth/register-profile-form.tsx` — add warning toast on silent catch                          |

---

## Task 1: Add i18n keys

Add 9 new keys to the `"register"` object in both locale files. All existing keys stay untouched.

**Files:**

- Modify: `i18n/vi/auth.json`
- Modify: `i18n/en/auth.json`

- [ ] **Step 1: Add keys to `i18n/vi/auth.json`**

Open the file and locate the `"register"` object. Append these 9 keys before the closing `}` of the `register` object:

```json
"otpSentSuccess": "Mã OTP đã được gửi đến {{phone}}",
"otpResent": "Đã gửi lại mã OTP",
"otpResendFailed": "Không gửi lại được mã. Vui lòng thử lại.",
"registerSuccess": "Đăng ký thành công. Chào mừng bạn!",
"profileUpdateFailed": "Chưa lưu được thông tin. Bạn có thể cập nhật sau trong Cài đặt.",
"changePhoneTitle": "Đổi số điện thoại?",
"changePhoneMessage": "Bạn sẽ phải nhập lại số điện thoại và mã OTP mới. Tiến độ hiện tại sẽ bị huỷ.",
"changePhoneConfirm": "Đổi số",
"backToOtp": "← Quay lại nhập OTP"
```

- [ ] **Step 2: Add keys to `i18n/en/auth.json`**

Same location (inside `"register"` object):

```json
"otpSentSuccess": "OTP code sent to {{phone}}",
"otpResent": "OTP code resent",
"otpResendFailed": "Failed to resend code. Please try again.",
"registerSuccess": "Account created successfully. Welcome!",
"profileUpdateFailed": "Could not save your info. You can update it later in Settings.",
"changePhoneTitle": "Change phone number?",
"changePhoneMessage": "You will need to enter a new phone number and verify with a new OTP. Current progress will be lost.",
"changePhoneConfirm": "Change number",
"backToOtp": "← Back to OTP"
```

- [ ] **Step 3: Validate both JSON files**

```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/phanquyetthang/mobile-movie-app/i18n/vi/auth.json','utf8')); console.log('vi OK')"
node -e "JSON.parse(require('fs').readFileSync('/Users/phanquyetthang/mobile-movie-app/i18n/en/auth.json','utf8')); console.log('en OK')"
```

Expected: `vi OK` and `en OK`.

- [ ] **Step 4: Commit**

```bash
cd /Users/phanquyetthang/mobile-movie-app
git add i18n/vi/auth.json i18n/en/auth.json
git commit -m "feat(i18n): add register UX polish translation keys"
```

---

## Task 2: Fix `register-otp-step.tsx` — OTP countdown bug + resend feedback + back confirm

Three fixes in one file:

1. **Bug**: `otpExpiresAt` is currently a frozen `useState` with no setter — after a successful resend, the server issues a fresh 10-minute OTP, but the UI countdown never resets. The `isOtpExpired` flag also stays `true` if it already fired before the resend.
2. **Missing feedback**: resend success has no toast; resend failure is silently swallowed.
3. **Missing confirm**: tapping "← Đổi số điện thoại" when OTP has been partially entered gives no warning.

**Files:**

- Modify: `components/auth/register-otp-step.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat -n /Users/phanquyetthang/mobile-movie-app/components/auth/register-otp-step.tsx
```

- [ ] **Step 2: Update imports**

Add `useState` import for `isConfirmOpen` state (it's already imported, just verify) and add `ConfirmationDialog` and `showToast`:

```tsx
import React, { memo, useCallback, useState } from 'react'
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
  type SharedValue,
} from 'react-native-reanimated'

import { AnimatedCountdownText } from './animated-countdown-text'
import { OTPInput } from './otp-input'
import { RegisterProgressBar } from './register-progress-bar'
import { ConfirmationDialog } from '@/components/dialog/confirmation-dialog'
import { Button } from '@/components/ui'
import {
  useAnimatedCountdown,
  useResendRegistration,
  useShakeAnimation,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { showToast } from '@/utils'
```

- [ ] **Step 3: Replace the timer state + resend handler + back handler**

Find the block starting with `// OTP expires in 10 minutes from mount` and replace everything through the `handleResend` function with:

```tsx
// OTP expiry — starts at 10 min from mount, resets to 10 min on successful resend
const [otpExpiresAt, setOtpExpiresAt] = useState(() =>
  new Date(Date.now() + 10 * 60 * 1000).toISOString(),
)

// Resend cooldown: 2 minutes, resets after each successful resend
const [resendAvailableAt, setResendAvailableAt] = useState(() =>
  new Date(Date.now() + 2 * 60 * 1000).toISOString(),
)

// UI thread countdown shared values — no JS re-renders during tick
const otpExpiryShared = useAnimatedCountdown({ expiresAt: otpExpiresAt })
const resendCooldownShared = useAnimatedCountdown({
  expiresAt: resendAvailableAt,
})

// JS-thread states updated once when countdowns hit 0
const [isOtpExpired, setIsOtpExpired] = useState(false)
const [isResendAvailable, setIsResendAvailable] = useState(false)

const [otpValue, setOtpValue] = useState('')
const [isConfirmOpen, setIsConfirmOpen] = useState(false)

const { mutate: resend, isPending: isResending } = useResendRegistration()

const { translateX, shake } = useShakeAnimation()

// Bridge OTP expiry from UI thread → JS (fires once per expiry window)
useAnimatedReaction(
  () => otpExpiryShared.value,
  (current, previous) => {
    if (current === 0 && previous !== null && previous > 0) {
      runOnJS(setIsOtpExpired)(true)
    }
  },
)

// Bridge resend cooldown from UI thread → JS (fires on each cooldown end)
useAnimatedReaction(
  () => resendCooldownShared.value,
  (current, previous) => {
    if (current === 0 && previous !== null && previous > 0) {
      runOnJS(setIsResendAvailable)(true)
    }
  },
)

const handleVerify = useCallback(() => {
  if (otpValue.length < 6 || isOtpExpired) {
    shake()
    return
  }
  navigateNative.push(
    `/auth/register/password?phone=${encodeURIComponent(phone)}&otp=${encodeURIComponent(otpValue)}`,
  )
}, [otpValue, isOtpExpired, phone, shake])

const handleResend = useCallback(() => {
  resend(phone, {
    onSuccess: () => {
      // Reset expiry window — server issued a fresh 10-min OTP
      setOtpExpiresAt(new Date(Date.now() + 10 * 60 * 1000).toISOString())
      setIsOtpExpired(false)
      // Reset resend cooldown
      setResendAvailableAt(new Date(Date.now() + 2 * 60 * 1000).toISOString())
      setIsResendAvailable(false)
      setOtpValue('')
      showToast(t('register.otpResent'), 'success')
    },
    onError: () => {
      showToast(t('register.otpResendFailed'), 'error')
    },
  })
}, [phone, resend, t])

const handleBackPress = useCallback(() => {
  // Only confirm if user has started typing (avoid annoying dialog on empty state)
  if (otpValue.length > 0) {
    setIsConfirmOpen(true)
  } else {
    navigateNative.back()
  }
}, [otpValue])
```

- [ ] **Step 4: Add the ConfirmationDialog to the JSX return**

At the end of the returned `<View>`, just before the closing `</View>`, add:

```tsx
<ConfirmationDialog
  isOpen={isConfirmOpen}
  onOpenChange={setIsConfirmOpen}
  title={t('register.changePhoneTitle')}
  description={t('register.changePhoneMessage')}
  confirmLabel={t('register.changePhoneConfirm')}
  cancelLabel={t('common.cancel')}
  onConfirm={() => navigateNative.back()}
  variant="destructive"
/>
```

- [ ] **Step 5: Update the "← Đổi số điện thoại" TouchableOpacity to use `handleBackPress`**

Find the TouchableOpacity with `onPress={() => navigateNative.back()}` at the bottom of the JSX and change its `onPress`:

```tsx
<TouchableOpacity
  className="py-2"
  onPress={handleBackPress}
  disabled={isResending}
>
  <Text className="text-center font-sans-medium text-sm text-amber-500 dark:text-amber-400">
    {t('register.changePhone')}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 6: Typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/auth/register-otp-step.tsx
git commit -m "fix(auth): fix OTP expiry countdown bug, add resend feedback, add back confirm dialog"
```

---

## Task 3: Add OTP-sent toast to `register-phone-form.tsx`

When the user submits their phone number and `initiateRegistration` succeeds with `isRegistered: false`, the screen silently pushes to the OTP screen with no confirmation. Add a success toast so the user knows the SMS was sent.

**Files:**

- Modify: `components/auth/register-phone-form.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat -n /Users/phanquyetthang/mobile-movie-app/components/auth/register-phone-form.tsx
```

- [ ] **Step 2: Add `showToast` to imports**

`showToast` is already imported from `@/utils` (via `showToast`). If it isn't, add it:

```tsx
import { showToast } from '@/utils'
```

- [ ] **Step 3: Add toast in the success branch before navigation**

Find the `onSuccess` callback in `onSubmit`. In the `else` branch (i.e., `isRegistered !== true`), add a toast call before the `navigateNative.push`:

```tsx
      onSuccess: (res) => {
        if (res.result?.isRegistered === true) {
          showToast(t('register.phoneAlreadyRegistered'), 'warning')
          navigateNative.replace('/auth/login')
        } else {
          showToast(
            t('register.otpSentSuccess', { phone: data.phonenumber }),
            'success',
          )
          navigateNative.push(
            `/auth/register/otp?phone=${encodeURIComponent(data.phonenumber)}`,
          )
        }
      },
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/auth/register-phone-form.tsx
git commit -m "feat(auth): show OTP sent confirmation toast on phone form submit"
```

---

## Task 4: Fix `register-password-form.tsx` — confirm dialog + register success toast

Two changes:

1. "← Đổi số điện thoại" on the password screen currently calls `navigateNative.back()` which goes back to the OTP screen, not the phone form. The label says "Đổi số điện thoại" but the action is wrong. Fix: show a `ConfirmationDialog` and on confirm, call `navigateNative.replace('/auth/register')` to put the user back on the phone entry form.

2. After `handleAuthSuccess` completes successfully, there is no feedback that registration worked. Add a success toast.

**Files:**

- Modify: `components/auth/register-password-form.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat -n /Users/phanquyetthang/mobile-movie-app/components/auth/register-password-form.tsx
```

- [ ] **Step 2: Update imports — add ConfirmationDialog, useState, showToast**

```tsx
import { useCallback, useState } from 'react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

import { RegisterProgressBar } from './register-progress-bar'
import { ConfirmationDialog } from '@/components/dialog/confirmation-dialog'
import { PasswordInputField } from '@/components/input/password-input-field'
import { PasswordRulesInput } from '@/components/input/password-rules-input'
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
import { showErrorToastMessage, showToast } from '@/utils'
```

- [ ] **Step 3: Add `isConfirmOpen` state and update `onSubmit` to include success toast**

Add state after the hook declarations, and update `onSubmit`:

```tsx
const [isConfirmOpen, setIsConfirmOpen] = useState(false)

const onSubmit = async (data: TRegisterPasswordSchema) => {
  try {
    const res = await completeRegistration({
      phonenumber: phone,
      otp,
      password: data.password,
    })
    await handleAuthSuccess(res.result, () => {
      showToast(t('register.registerSuccess'), 'success')
      navigateNative.replace('/auth/register/profile')
    })
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 400 || status === 422) {
      showErrorToastMessage(t('register.otpInvalid'))
      navigateNative.replace(
        `/auth/register/otp?phone=${encodeURIComponent(phone)}`,
      )
    }
  }
}
```

- [ ] **Step 4: Update the "← Đổi số điện thoại" TouchableOpacity to open the confirm dialog**

Find the `TouchableOpacity` that calls `navigateNative.back()` and change its `onPress`:

```tsx
<TouchableOpacity
  className="py-2"
  onPress={() => setIsConfirmOpen(true)}
  disabled={isLoading}
>
  <Text className="text-center font-sans-medium text-sm text-amber-500 dark:text-amber-400">
    {t('register.changePhone')}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 5: Add ConfirmationDialog before the closing `</View>` of the return**

```tsx
<ConfirmationDialog
  isOpen={isConfirmOpen}
  onOpenChange={setIsConfirmOpen}
  title={t('register.changePhoneTitle')}
  description={t('register.changePhoneMessage')}
  confirmLabel={t('register.changePhoneConfirm')}
  cancelLabel={t('common.cancel')}
  onConfirm={() => navigateNative.replace('/auth/register')}
  variant="destructive"
/>
```

Note: `navigateNative.replace('/auth/register')` replaces the password screen with the phone form. The old OTP screen remains in the stack history but is not reachable via normal navigation.

- [ ] **Step 6: Typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/auth/register-password-form.tsx
git commit -m "feat(auth): add confirm dialog for change phone, add register success toast"
```

---

## Task 5: Fix silent failure in `register-profile-form.tsx`

The `catch` block currently discards errors silently. The user thinks their profile was saved but it wasn't — they'll be surprised when they open Settings and see empty fields.

Add a `warning` toast in the `catch` block. Keep the `finally → goHome()` pattern so the user always lands on home.

**Files:**

- Modify: `components/auth/register-profile-form.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat -n /Users/phanquyetthang/mobile-movie-app/components/auth/register-profile-form.tsx
```

- [ ] **Step 2: Add `showToast` import**

Add to the import block (currently no toast import):

```tsx
import { showToast } from '@/utils'
```

- [ ] **Step 3: Add warning toast in the catch block**

Find:

```tsx
    } catch {
      // silent — profile update is best-effort
    } finally {
```

Replace with:

```tsx
    } catch {
      showToast(t('register.profileUpdateFailed'), 'warning')
    } finally {
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/auth/register-profile-form.tsx
git commit -m "fix(auth): show warning toast when profile update fails at registration step 4"
```

---

## Task 6: Final check

- [ ] **Step 1: Full check**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run check
```

Expected: no TypeScript errors, no lint errors.

- [ ] **Step 2: Verify i18n keys exist**

```bash
node -e "
const vi = require('./i18n/vi/auth.json').register
const en = require('./i18n/en/auth.json').register
const keys = ['otpSentSuccess','otpResent','otpResendFailed','registerSuccess','profileUpdateFailed','changePhoneTitle','changePhoneMessage','changePhoneConfirm','backToOtp']
keys.forEach(k => {
  if (!vi[k]) console.error('MISSING vi:', k)
  if (!en[k]) console.error('MISSING en:', k)
})
console.log('All keys checked')
"
```

Expected: `All keys checked` with no MISSING lines.

- [ ] **Step 3: Verify git log**

```bash
git log --oneline -8
```

Expected: 5 commits from this plan (i18n, otp-step, phone-form, password-form, profile-form).

- [ ] **Step 4: Final commit if any lint fixes were needed**

Only commit if `npm run check` caused any auto-fixed changes:

```bash
git add -A
git commit -m "chore(auth): lint fixes for register UX polish"
```
