# Register Flow — OTP-Based Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Thay thế flow đăng ký 1 màn hiện tại bằng flow OTP 4 bước, tách màn hình rõ ràng, có progress bar.

**Architecture:** 4 Expo Router screens dưới `app/auth/register/`, state nhạy cảm (phone, otp) truyền qua route params, không lưu Zustand. Sau bước 3 đã có token → auto login → màn 4 là profile tuỳ chọn.

**Tech Stack:** Expo Router file-based routing, React Hook Form + Zod, TanStack Mutation, OTPInput component (có sẵn), PASSWORD_REGEX (có sẵn).

---

## Tổng quan flow

```
[1] /auth/register           — Nhập SĐT → initiateRegistration()
[2] /auth/register/otp       — OTP alphanumeric 6 ký tự, 10 phút, resend
[3] /auth/register/password  — Mật khẩu + xác nhận → completeRegistration() → auto login
[4] /auth/register/profile   — Họ, Tên, Ngày sinh (tuỳ chọn, có nút Bỏ qua)
```

**State truyền qua route params:**

- `[1] → [2]`: `?phone=0901234567`
- `[2] → [3]`: `?phone=0901234567&otp=AB1234`
- `[3] → [4]`: không cần param (đã login, dùng token)

---

## Thay đổi cần thiết (pre-work)

### 1. Rename type conflict — `types/user.type.ts`

`ICompleteRegistrationRequest` trong `user.type.ts` (slug + firstName + lastName + dob + address) trùng tên với interface trong `auth.type.ts`. Rename thành `ICompleteUserProfileRequest`.

Cập nhật `api/user.ts`: thay `ICompleteRegistrationRequest` → `ICompleteUserProfileRequest`.

### 2. Fix response type — `api/auth.ts`

`completeRegistration` hiện trả về `IApiResponse<{ isRegistered: boolean }>` — sai. API thực tế trả về tokens. Sửa thành:

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

### 3. Cập nhật hooks — `hooks/use-auth.ts`

Xoá `useRegister` (chỉ dùng ở register-form.tsx cũ, sẽ bị xoá).

Thêm 3 hooks mới:

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

Thêm import: `initiateRegistration`, `resendRegistration`, `completeRegistration` từ `@/api`.

---

## File structure

```
app/auth/
  register/
    index.tsx         ← Màn 1: SĐT (thay register.tsx cũ)
    otp.tsx           ← Màn 2: OTP
    password.tsx      ← Màn 3: Mật khẩu
    profile.tsx       ← Màn 4: Hồ sơ tuỳ chọn

components/auth/
  register-phone-form.tsx     ← Form nhập SĐT
  register-otp-step.tsx       ← OTP step (wrap OTPInput + countdown)
  register-password-form.tsx  ← Form mật khẩu
  register-profile-form.tsx   ← Form hồ sơ tuỳ chọn

schemas/auth.schema.ts        ← Thêm useRegisterPasswordSchema
```

**Xoá:**

- `app/auth/register.tsx` (thay bằng `register/index.tsx`)
- `components/auth/register-form.tsx` (thay bằng 4 form components)

---

## Chi tiết từng màn

### Màn 1 — `app/auth/register/index.tsx`

**Component:** `RegisterPhoneForm`

**UI:**

- Progress bar: 4 đoạn, đoạn 1 active
- Title: "Tạo tài khoản"
- Subtitle: "Nhập số điện thoại để bắt đầu"
- Input SĐT: prefix `+84`, keyboardType `number-pad`, `transformOnChange` strip non-digit, maxLength 10
- Nút "Tiếp theo" (disabled khi chưa đủ 10 số)
- Link "Đã có tài khoản? Đăng nhập"

**Logic:**

```
onSubmit(phonenumber):
  initiateRegistration(phonenumber)
    onSuccess: { isRegistered: true }  → showToast("SĐT đã đăng ký") + router.replace('/auth/login')
    onSuccess: { isRegistered: false } → router.push(`/auth/register/otp?phone=${phonenumber}`)
    onError: showErrorToast (global handler)
```

**Validation:** `phonenumber` — 10 chữ số, regex `PHONE_NUMBER_REGEX` (có sẵn).

---

### Màn 2 — `app/auth/register/otp.tsx`

**Params:** `phone: string` (từ route)

**Component:** `RegisterOtpStep`

**UI:**

- Progress bar: đoạn 1-2 active
- Title: "Xác nhận OTP"
- Subtitle: "Mã 6 ký tự đã gửi đến **{phone}**"
- `OTPInput` length=6, **characterSet='alphanumeric'**
- Countdown đếm ngược từ **10 phút** (600s) — reuse `useAnimatedCountdown` + `AnimatedCountdownText`
- Nút "Gửi lại" (disabled khi countdown chưa hết, enabled khi expired)
- Nút "Xác nhận" (disabled khi OTP chưa đủ 6 ký tự hoặc expired)
- Link "← Đổi số điện thoại" → `router.back()`

**Logic:**

```
onVerify(otp):
  → router.push(`/auth/register/password?phone=${phone}&otp=${otp}`)
  (không gọi API — server verify OTP ở bước completeRegistration)

onResend():
  resendRegistration(phone)
    onSuccess: reset countdown 600s, reset OTP value

onExpired():
  OTPInput disabled, nút Xác nhận disabled, nút Gửi lại enabled
```

**Hai timer độc lập:**

| Timer                | Thời gian                  | Reset khi resend?                    |
| -------------------- | -------------------------- | ------------------------------------ |
| Expiry (OTP hết hạn) | 10 phút từ lúc tạo         | **Không** — tiếp tục đếm             |
| Resend cooldown      | 2 phút từ lúc gửi gần nhất | **Có** — reset 2 phút mỗi lần resend |

`initiateRegistration` không trả về `expiresAt`. Tính client-side khi màn mount:

```ts
// Tính 1 lần lúc mount, không thay đổi khi resend
const [otpExpiresAt] = useState(() =>
  new Date(Date.now() + 10 * 60 * 1000).toISOString(),
)
// Resend cooldown — reset sau mỗi lần resend thành công
const [resendAvailableAt, setResendAvailableAt] = useState(() =>
  new Date(Date.now() + 2 * 60 * 1000).toISOString(),
)
```

**UI states:**

- OTP input: disabled khi `otpExpiresAt` hết
- Nút "Xác nhận": disabled khi `otp.length < 6` hoặc OTP expired
- Nút "Gửi lại":
  - `now < resendAvailableAt`: disabled, hiện countdown "Gửi lại (1:45)"
  - `now >= resendAvailableAt` và OTP chưa hết: enabled (primary style)
  - OTP đã hết hạn: enabled (cần mã mới)

**Logic resend:**

```ts
onResend():
  resendRegistration(phone)
    onSuccess:
      setResendAvailableAt(new Date(Date.now() + 2 * 60 * 1000).toISOString())
      // otpExpiresAt KHÔNG thay đổi
      resetOtpValue('')
```

**Lưu ý:** OTP chỉ được validate phía server tại bước 3. Màn này chỉ kiểm tra length = 6.

---

### Màn 3 — `app/auth/register/password.tsx`

**Params:** `phone: string`, `otp: string` (từ route)

**Component:** `RegisterPasswordForm`

**UI:**

- Progress bar: đoạn 1-3 active
- Title: "Đặt mật khẩu"
- Subtitle: "Tối thiểu 8 ký tự, bao gồm chữ và số"
- Password input với `PasswordRulesInput` (có sẵn — hiển thị strength bar)
- Confirm password với `PasswordInputField` (có sẵn)
- Nút "Tạo tài khoản"

**Schema** (thêm vào `schemas/auth.schema.ts`):

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
      confirmPassword: z.string().min(1, t('register.confirmPasswordRequired')),
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

**Logic:**

```
onSubmit({ password }):
  completeRegistration({ phonenumber: phone, otp, password })
    onSuccess(tokens):
      await handleAuthSuccess(tokens)   // lưu token, set isAuthenticated
      router.replace('/auth/register/profile')
    onError (code 400/OTP sai):
      showErrorToast("Mã OTP không hợp lệ hoặc đã hết hạn")
      router.replace(`/auth/register/otp?phone=${phone}`)  // quay lại nhập lại OTP
    onError (other):
      global error handler
```

---

### Màn 4 — `app/auth/register/profile.tsx`

**Component:** `RegisterProfileForm`

**UI:**

- Progress bar: cả 4 đoạn active
- Title: "Hoàn thiện hồ sơ 🎉"
- Subtitle: "Bạn có thể bỏ qua và điền sau trong Cài đặt"
- FormInput: Họ (optional), Tên (optional)
- DobExpandablePicker: Ngày sinh (optional) — reuse component có sẵn
- Nút "Hoàn thành" (primary)
- Nút "Bỏ qua" (text, amber color) → `router.replace('/(tabs)/home')`

**Logic:**

```
onSubmit({ firstName, lastName, dob }):
  try {
    await updateProfile({ firstName: firstName || null, lastName: lastName || null, dob: dob || null })
  } catch {} // silent — luôn vào home dù fail
  router.replace('/(tabs)/home')

onSkip():
  router.replace('/(tabs)/home')
```

**Lưu ý:** Không có `useUpdateProfile` hook — gọi trực tiếp `updateProfile` từ `@/api/profile` với try/catch. Nếu user bỏ qua, không gọi API.

---

## Progress Bar Component

Tạo inline trong mỗi screen (không cần component riêng vì rất nhỏ):

```tsx
function RegisterProgressBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <View className="mb-6 flex-row gap-1">
      {[1, 2, 3, 4].map((s) => (
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

---

## Error handling

| Lỗi                  | Nơi xảy ra            | Xử lý                     |
| -------------------- | --------------------- | ------------------------- |
| SĐT đã đăng ký       | Màn 1                 | Toast + redirect login    |
| Gửi OTP thất bại     | Màn 1                 | Global error toast        |
| Gửi lại OTP thất bại | Màn 2                 | Global error toast        |
| OTP sai/hết hạn      | Màn 3 (server trả về) | Toast + redirect về màn 2 |
| Lỗi server khác      | Màn 3                 | Global error toast        |
| updateProfile fail   | Màn 4                 | Im lặng, vẫn vào home     |

---

## Không thay đổi

- `app/auth/login.tsx` — không đổi
- `app/auth/forgot-password.tsx` — không đổi
- `api/user.ts` `completeRegistration` — function khác, endpoint khác (`/user/:slug/complete-registration`), chỉ rename type
- `OTPInput` component — dùng nguyên, chỉ set `characterSet='alphanumeric'`
- `PasswordRulesInput`, `PasswordInputField` — dùng nguyên
- `DobExpandablePicker` — dùng nguyên
- i18n keys `register.*` — reuse các key có sẵn, thêm key mới cho màn 2 và màn 4 nếu cần
