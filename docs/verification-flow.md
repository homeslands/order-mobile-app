# Flow xác thực SĐT & Email

## API Endpoints

| Loại | Endpoint | Chức năng |
|------|----------|-----------|
| **Email** | `POST /auth/initiate-verify-email` | Gửi OTP |
| | `POST /auth/confirm-email-verification/code` | Xác thực OTP |
| | `POST /auth/resend-verify-email` | Gửi lại OTP |
| **Phone** | `POST /auth/initiate-verify-phone-number` | Gửi OTP SMS |
| | `POST /auth/confirm-phone-number-verification/code` | Xác thực OTP |
| | `POST /auth/resend-verify-phone-number` | Gửi lại OTP |
| **Forgot password** | `POST /auth/forgot-password/initiate` | Gửi OTP |
| | `POST /auth/forgot-password/confirm` | Verify OTP → nhận token |
| | `POST /auth/forgot-password/resend` | Gửi lại OTP |
| | `POST /auth/forgot-password/change` | Đổi password bằng token |

---

## Flow xác thực Email / Phone (từ profile)

```
1. User click "Xác thực"
   → Dialog mở

2. Nhập email / hiện sẵn SĐT → Submit
   → POST initiate-verify-*
   → Response: { expiresAt }
   → Store vào useUserStore (emailVerificationStatus / phoneNumberVerificationStatus)

3. Dialog chuyển sang OTP screen
   → OTPInput (6 ô) + CountdownTimer (trừ 30s buffer cho network)

4. Nhập OTP → Submit
   → POST confirm-*-verification/code { code }
   → Success: invalidate profile query, đóng dialog

5. OTP hết hạn → clear status, disable nút
   Resend → POST resend-verify-* → cập nhật expiresAt mới
```

---

## Flow Forgot Password

```
Step 1 — Nhập phone / email
   → POST /auth/forgot-password/initiate { phonenumber/email, verificationMethod }
   → Response: { expiresAt }
   → Lưu vào forgot-password.store

Step 2 — Nhập OTP
   → POST /auth/forgot-password/confirm { code }
   → Response: { token } (FE tự tính expiry 5 phút)
   → Lưu token vào store

Step 3 — Đổi mật khẩu
   → Kiểm tra token chưa hết hạn
   → POST /auth/forgot-password/change { newPassword, token }
   → Navigate về LOGIN
```

---

## Components

| File | Chức năng |
|------|-----------|
| `src/components/ui/otp-input.tsx` | 6 ô OTP, auto-focus, paste, arrow keys |
| `src/components/ui/countdown-timer.tsx` | Đếm ngược từ `expiresAt`, callback `onExpired` |
| `src/components/app/dialog/send-verify-email-dialog.tsx` | Dialog xác thực email (2 state: nhập email → nhập OTP) |
| `src/components/app/dialog/send-verify-phone-number-dialog.tsx` | Dialog xác thực SĐT (2 state: confirm SĐT → nhập OTP) |
| `src/components/app/form/forgot-password-by-phone-form.tsx` | Form nhập SĐT cho forgot password |
| `src/components/app/form/forgot-password-by-email-form.tsx` | Form nhập email cho forgot password |
| `src/components/app/form/update-phone-number-form.tsx` | Form cập nhật SĐT (dùng trong scan RFID dialog) |
| `src/app/auth/forgot-password-by-phone.tsx` | Page forgot password qua SĐT (3 bước) |
| `src/app/auth/forgot-password-by-email.tsx` | Page forgot password qua email (3 bước) |

---

## Hooks

File: `src/hooks/use-auth.ts`

```ts
// Email Verification
useVerifyEmail()                  // POST /auth/initiate-verify-email
useConfirmEmailVerification()     // POST /auth/confirm-email-verification/code
useResendEmailVerification()      // POST /auth/resend-verify-email

// Phone Verification
useVerifyPhoneNumber()            // POST /auth/initiate-verify-phone-number
useConfirmPhoneNumberVerification() // POST /auth/confirm-phone-number-verification/code
useResendPhoneNumberVerification()  // POST /auth/resend-verify-phone-number

// Forgot Password
useInitiateForgotPassword()       // POST /auth/forgot-password/initiate
useVerifyOTPForgotPassword()      // POST /auth/forgot-password/confirm
useResendOTPForgotPassword()      // POST /auth/forgot-password/resend
useConfirmForgotPassword()        // POST /auth/forgot-password/change
```

---

## State Management

### useUserStore (`src/stores/user.store.ts`)
```ts
emailVerificationStatus: { expiresAt: string; slug?: string } | null
phoneNumberVerificationStatus: { expiresAt: string; slug?: string } | null
isVerifyingEmail: boolean
isVerifyingPhoneNumber: boolean
```

### useForgotPasswordStore (`src/stores/forgot-password.store.ts`)
```ts
step: number              // 1: nhập phone/email, 2: OTP, 3: reset password
token: string             // reset token nhận từ /confirm
email: string
phoneNumber: string
verificationMethod: 'email' | 'phone-number'
expireTime: string        // OTP expiration (ISO)
tokenExpireTime: string   // token expiration (FE tự tính, 5 phút)
```

---

## Types

File: `src/types/auth.type.ts`
```ts
IInitiateForgotPasswordRequest    // { email?, phonenumber?, verificationMethod }
IVerifyOTPForgotPasswordRequest   // { code }
IResendOTPForgotPasswordRequest   // { email?, phonenumber?, verificationMethod }
IConfirmForgotPasswordRequest     // { newPassword, token }
IInitiateForgotPasswordResponse   // { expiresAt }
IVerifyOTPForgotPasswordResponse  // { token }
```

File: `src/types/profile.type.ts`
```ts
IVerifyEmailRequest               // { accessToken, email }
IEmailVerificationResponse        // { expiresAt, slug, createdAt }
```

---

## Validation

| Field | Rule |
|-------|------|
| SĐT | `/^[0-9]{10,11}$/` |
| Email | `z.string().email()` |
| OTP | 6 ký tự (số hoặc chữ tùy `allowText` prop) |
| Password | min 8, max 20 ký tự |

---

## Điểm đáng chú ý

1. **30s buffer** trong countdown — tránh race condition khi OTP sắp hết hạn phía FE trước BE
2. **Smart reuse OTP** — nếu gửi forgot password cùng phone/email và OTP vẫn còn hạn, không cần gửi lại
3. **Token 5 phút** (step 3 forgot password) — FE tự tính từ thời điểm nhận token, không phụ thuộc server
4. **Verification method enum** — `VerificationMethod.EMAIL = 'email'` / `VerificationMethod.PHONE_NUMBER = 'phone-number'` (file `src/constants/auth.ts`)
