# Forgot Password Flow - Complete Documentation

## 1. Tổng Quan

```
┌────────────────────────────────────────────────────────┐
│ FORGOT PASSWORD SYSTEM                                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📍 Method Selection                                   │
│  └─ Email hoặc Phone Number?                          │
│                                                        │
│  📧 Email Flow        OR        📱 Phone Flow         │
│  ├─ Send OTP via email         ├─ Send OTP via       │
│  ├─ 10 min expiration          │  Zalo + SMS         │
│  ├─ User enters code           ├─ 10 min expiration  │
│  └─ Verify OTP                 ├─ User enters code   │
│                                └─ Verify OTP         │
│                                                        │
│  🔑 JWT Token (5 min)                                 │
│  └─ Generated after OTP verified                      │
│                                                        │
│  🔒 Reset Password                                    │
│  ├─ Enter new password (8-20 chars, letter+number)   │
│  ├─ Confirm password match                           │
│  ├─ Uses JWT to verify                               │
│  └─ Password hashed with bcrypt                       │
│                                                        │
│  ✅ Success                                            │
│  └─ Redirects to login                               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Route & Page Structure

### 2.1 Routes

| Route | File | Purpose | User |
|-------|------|---------|------|
| `/auth/forgot-password` | `forgot-password.tsx` | Method selection | Public |
| `/auth/forgot-password/email` | `forgot-password-by-email.tsx` | Email-based flow | Public |
| `/auth/forgot-password/phone` | `forgot-password-by-phone.tsx` | Phone-based flow | Public |
| `/auth/login` | (redirect) | After success | Public |

### 2.2 Components & Forms

```
forgot-password.tsx
├─ Buttons:
│  ├─ "Reset via Email"
│  └─ "Reset via Phone Number"
│
forgot-password-by-email.tsx
├─ Step 1: Input email → forgot-password-by-email-form.tsx
├─ Step 2: Enter OTP → OTP Input Component
├─ Step 3: Reset password → reset-password-form.tsx
└─ Timers & Buttons
│
forgot-password-by-phone.tsx
├─ Step 1: Input phone → forgot-password-by-phone-form.tsx
├─ Step 2: Enter OTP → OTP Input Component
├─ Step 3: Reset password → reset-password-form.tsx
└─ Timers & Buttons

reset-password-form.tsx
├─ New Password Input
│  └─ password-with-rules-for-reset-input.tsx
│     ├─ Rules validation (real-time)
│     ├─ Min 8 chars
│     ├─ Max 20 chars
│     ├─ Contains letter
│     └─ Contains number
├─ Confirm Password Input
└─ Submit Button
```

---

## 3. State Management (Zustand Store)

### 3.1 Store Structure

```typescript
// File: src/stores/forgot-password.store.ts

interface IForgotPasswordStore {
  // Identity information
  email: string                      // User's email
  phoneNumber: string                // User's phone number

  // Current step tracking
  step: number                       // 1, 2, or 3

  // Verification method
  verificationMethod: string         // 'email' or 'phone-number'

  // Token & Expiration
  token: string                      // JWT token for password reset
  expireTime: string                 // OTP expiration time (ISO)
  tokenExpireTime: string            // JWT token expiration time (ISO)

  // Actions
  setEmail(email: string): void
  setPhoneNumber(phone: string): void
  setStep(step: number): void
  setVerificationMethod(method: string): void
  setToken(token: string): void
  setExpireTime(time: string): void
  setTokenExpireTime(time: string): void
  resetStore(): void                 // Clear all after success
}
```

### 3.2 Store Usage

```typescript
// In component
const { email, step, expireTime, setStep, setToken, resetStore } =
  useForgotPasswordStore()

// Update state
setStep(2)  // Go to OTP input step
setToken(jwtToken)  // Store JWT from OTP verification
resetStore()  // Clear everything after password changed
```

---

## 4. API Endpoints

### 4.1 All Endpoints (Public, Rate-Limited)

| Endpoint | Method | Rate Limit | Purpose |
|----------|--------|-----------|---------|
| `/auth/forgot-password/initiate` | POST | 3/min | Start forgot password |
| `/auth/forgot-password/resend` | POST | 3/min | Resend OTP code |
| `/auth/forgot-password/confirm` | POST | 3/min | Verify OTP, get JWT |
| `/auth/forgot-password/change` | POST | 3/min | Change password |

### 4.2 Request/Response Schemas

```typescript
// ========== STEP 1: Initiate ==========
POST /auth/forgot-password/initiate

Request:
{
  email?: string                           // For email method
  phonenumber?: string                     // For phone method
  verificationMethod: 'email' | 'phone-number'
}

Response:
{
  code: 0,
  message: "success",
  data: {
    expiresAt: "2026-03-30T10:40:00Z"   // OTP expires in 10 min
  }
}

Errors (Status Codes):
- 119000: Invalid phone number format
- 119022: Invalid email format
- 119006: User not found (email/phone)
- 119009: Forgot password token already exists (wait before retry)

// ========== STEP 2A: Resend OTP ==========
POST /auth/forgot-password/resend

Request:
{
  email?: string
  phonenumber?: string
  verificationMethod: 'email' | 'phone-number'
}

Response:
{
  code: 0,
  message: "success",
  data: {
    expiresAt: "2026-03-30T10:40:00Z"
  }
}

// ========== STEP 2B: Verify OTP ==========
POST /auth/forgot-password/confirm

Request:
{
  code: "ABC123"  // 6-character OTP
}

Response:
{
  code: 0,
  message: "success",
  data: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // JWT for step 3
  }
}

Errors:
- 119018: OTP token not found
- 119008: OTP token expired
- 119010: Invalid/wrong OTP code

// ========== STEP 3: Change Password ==========
POST /auth/forgot-password/change

Request:
{
  newPassword: "SecurePass123",  // Must meet rules
  token: "eyJhbGc..."            // JWT from verify
}

Response:
{
  code: 0,
  message: "success",
  data: "Forgot password changed successfully"
}

Errors:
- 119001: Password invalid (doesn't meet rules)
- 119008: Token expired
- 119038: Token doesn't exist
```

---

## 5. Complete Step-by-Step Flow

### 5.1 Email Method Flow

```
STEP 0: User clicks "Forgot Password" on login page
     │
     ▼
STEP 1: SELECT METHOD
[/auth/forgot-password]
     │
     ├─ Button: "Reset via Email"
     │  └─ Sets: verificationMethod = 'email'
     │  └─ Navigates to: /auth/forgot-password/email
     │
     ▼
STEP 2: ENTER EMAIL
[/auth/forgot-password/email - Step 1]
     │
     ├─ User enters email address
     │
     ├─ Form validation:
     │  ├─ Email required
     │  ├─ Valid email format
     │  └─ Real-time feedback
     │
     ├─ User clicks "Send OTP"
     │
     ├─ Call: useInitiateForgotPassword()
     │  │
     │  └─ POST /auth/forgot-password/initiate
     │     {
     │       "email": "user@example.com",
     │       "verificationMethod": "email"
     │     }
     │
     ├─ Backend process:
     │  ├─ Find user by email
     │  ├─ Check: No valid OTP already exists
     │  ├─ Generate 6-char OTP (random uppercase)
     │  ├─ Set expiration: now + 10 minutes
     │  ├─ Save to DB: ForgotPasswordToken
     │  ├─ Send via SMTP email
     │  └─ Return expiresAt
     │
     ├─ Response:
     │  {
     │    "expiresAt": "2026-03-30T10:40:00Z"
     │  }
     │
     ├─ Frontend:
     │  ├─ Store email in store
     │  ├─ Store expiresAt in store
     │  ├─ setStep(2) - Go to OTP input
     │  ├─ Start countdown timer (10 min)
     │  └─ Show loading state off
     │
     ▼
STEP 3: ENTER OTP
[/auth/forgot-password/email - Step 2]
     │
     ├─ Display:
     │  ├─ "Check your email for OTP code"
     │  ├─ Masked email: "u***@example.com"
     │  ├─ OTP input field (6 chars, numeric)
     │  ├─ Countdown timer: "Code expires in X minutes"
     │  └─ "Resend OTP" link (disabled until timer close)
     │
     ├─ User receives email with OTP
     │
     ├─ User enters OTP (e.g., "123456")
     │
     ├─ Countdown timer reaches 0:
     │  └─ "Resend OTP" button becomes enabled
     │
     ├─ IF USER CLICKS "RESEND OTP":
     │  │
     │  ├─ Call: useResendOTPForgotPassword()
     │  │
     │  └─ POST /auth/forgot-password/resend
     │     {
     │       "email": "user@example.com",
     │       "verificationMethod": "email"
     │     }
     │
     │  Backend:
     │  ├─ Find existing ForgotPasswordToken
     │  ├─ Delete old token
     │  ├─ Generate new OTP
     │  ├─ Send new OTP via email
     │  └─ Return new expiresAt
     │
     │  Frontend:
     │  ├─ Update expiresAt
     │  ├─ Reset countdown (10 min)
     │  ├─ Clear OTP input
     │  └─ Show "OTP resent" toast
     │
     ├─ User enters OTP
     │
     ├─ User clicks "Verify"
     │
     ├─ Call: useVerifyOTPForgotPassword()
     │  │
     │  └─ POST /auth/forgot-password/confirm
     │     {
     │       "code": "123456"
     │     }
     │
     ├─ Backend:
     │  ├─ Find ForgotPasswordToken by code
     │  ├─ Validate: Token exists
     │  ├─ Validate: Token not expired
     │  ├─ Generate JWT token (5 min expiration)
     │  │  └─ Payload: { sub: userId, jti: tokenId }
     │  ├─ Mark original OTP as expired
     │  ├─ Save new ForgotPasswordToken with JWT
     │  └─ Return JWT
     │
     ├─ Response:
     │  {
     │    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     │  }
     │
     ├─ Frontend:
     │  ├─ Store JWT in store
     │  ├─ Calculate tokenExpireTime = now + 5 min
     │  ├─ Store tokenExpireTime in store
     │  ├─ setStep(3) - Go to password reset
     │  ├─ Start new countdown (5 min JWT expiration)
     │  └─ Show "OTP verified" toast
     │
     ▼
STEP 4: RESET PASSWORD
[/auth/forgot-password/email - Step 3]
     │
     ├─ Display:
     │  ├─ "Create New Password"
     │  ├─ Password input with rules display
     │  │  └─ password-with-rules-for-reset-input.tsx
     │  │     ├─ Real-time rule validation:
     │  │     │  ├─ ✓ Min 8 characters (required)
     │  │     │  ├─ ✓ Max 20 characters (optional)
     │  │     │  ├─ ✓ Contains letter (required)
     │  │     │  └─ ✓ Contains number (required)
     │  │     ├─ Password strength indicator
     │  │     ├─ Color coded: Green (strong), Yellow (medium)
     │  │     └─ Submit button disabled until all rules met
     │  │
     │  ├─ Confirm password input
     │  │  └─ Real-time: Must match new password
     │  │
     │  ├─ Countdown timer: "Token expires in X minutes"
     │  │  └─ If expires: "Token expired, restart from Step 1"
     │  │
     │  └─ "Reset Password" button (enabled when valid)
     │
     ├─ User enters password meeting all rules
     │
     ├─ User enters matching confirm password
     │
     ├─ User clicks "Reset Password"
     │
     ├─ Call: useConfirmForgotPassword()
     │  │
     │  └─ POST /auth/forgot-password/change
     │     {
     │       "newPassword": "SecurePass123",
     │       "token": "eyJhbGc..."
     │     }
     │
     ├─ Backend:
     │  ├─ Verify JWT token validity
     │  ├─ Decode JWT: Extract sub (userId), jti (tokenId)
     │  ├─ Find ForgotPasswordToken by jti
     │  ├─ Fetch user object
     │  ├─ If user has NEED_UPDATE_PASSWORD requirement:
     │  │  └─ Mark it as COMPLETED
     │  ├─ Hash new password with bcrypt
     │  ├─ Save user with new password
     │  ├─ Delete ForgotPasswordToken (cleanup)
     │  ├─ Clear all blocking requirements
     │  └─ Return success
     │
     ├─ Response:
     │  {
     │    "message": "Forgot password changed successfully"
     │  }
     │
     ├─ Frontend:
     │  ├─ Show success toast
     │  ├─ Call: resetStore() - Clear all forgot password state
     │  ├─ Navigate to: /auth/login
     │  └─ User can now login with new password
     │
     ▼
END - User logs in with new password
```

### 5.2 Phone Method Flow

```
Same as EMAIL flow, but:

STEP 1: SELECT METHOD → "Reset via Phone Number"
        └─ Navigates to: /auth/forgot-password/phone

STEP 2: ENTER PHONE
        └─ User enters 10-digit phone number
        └─ POST /auth/forgot-password/initiate
           {
             "phonenumber": "0901234567",  // 10 digits
             "verificationMethod": "phone-number"
           }

        Backend OTP delivery (multi-channel):
        ├─ Primary: Send via Zalo OA
        │  └─ Message template with OTP
        ├─ Fallback: Send via SMS
        │  └─ If Zalo fails
        └─ Track both with request IDs

STEP 3: ENTER OTP
        └─ User receives OTP via Zalo or SMS
        └─ Display phone number: "08***34567"
        └─ Rest same as email method

STEP 4: RESET PASSWORD
        └─ Identical to email method
```

---

## 6. Password Validation Rules

### 6.1 Validation Component

```typescript
// File: password-with-rules-for-reset-input.tsx

const PasswordValidationRules = [
  {
    label: "Min 8 characters",
    regex: /.{8,}/,
    required: true
  },
  {
    label: "Max 20 characters",
    regex: /^.{0,20}$/,
    required: false  // Optional but checked
  },
  {
    label: "Contains letter",
    regex: /[a-zA-Z]/,
    required: true
  },
  {
    label: "Contains number",
    regex: /[0-9]/,
    required: true
  }
]

// Real-time feedback:
// ✓ = requirement met (green)
// ✗ = requirement not met (red)
// ○ = not checked yet (gray)
```

### 6.2 UI Feedback

```
┌─────────────────────────────────┐
│ New Password Requirements        │
├─────────────────────────────────┤
│                                 │
│ ✓ Min 8 characters   (green)    │
│ ✗ Max 20 characters  (red)      │
│ ○ Contains letter    (gray)     │
│ ✗ Contains number    (red)      │
│                                 │
│ [Password Strength Bar]         │
│ Weak                            │
│                                 │
│ [Confirm Password Input]        │
│ ✗ Passwords must match          │
│                                 │
│ [Submit Button - DISABLED]      │
│                                 │
└─────────────────────────────────┘
```

---

## 7. Error Handling & Edge Cases

### 7.1 Error Codes

```
Backend Error Codes:
────────────────────

119000: toast.invalidPhoneNumber
        └─ Phone number format invalid

119022: toast.invalidEmail
        └─ Email format invalid

119006: toast.userNotFound
        └─ No user with that email/phone

119009: toast.forgotPasswordTokenExists
        └─ User already has valid OTP
        └─ Message: "Please wait before requesting another code"

119001: toast.invalidPassword
        └─ Password doesn't meet rules

119018: toast.emailTokenNotFound
        └─ OTP code invalid/doesn't exist

119008: toast.forgotTokenExpired
        └─ OTP or JWT token expired

119038: toast.forgotPasswordTokenNotExists
        └─ Token doesn't exist in system
```

### 7.2 Frontend Validations

```
STEP 1: Email/Phone Input
├─ Email empty? → Show error below input
├─ Invalid email format? → Show format hint
├─ Invalid phone format? → Show "10 digits required"
└─ User not found? → Show "No account with this {email/phone}"

STEP 2: OTP Input
├─ OTP empty? → Disable verify button
├─ OTP < 6 chars? → Show "Enter 6 characters"
├─ OTP incorrect? → Show "Invalid or expired OTP code"
├─ Expired? → Show "Code expired" + enable resend
└─ Too many attempts? → Temporary block

STEP 3: Password Reset
├─ Password < 8 chars? → Show rule status (red X)
├─ No letter? → Show rule status (red X)
├─ No number? → Show rule status (red X)
├─ Confirm doesn't match? → Show "Passwords must match"
├─ Token expired? → Navigate back to step 1
└─ All valid? → Enable submit button
```

---

## 8. Timers & Countdown

### 8.1 OTP Countdown (10 minutes)

```
Start: User gets OTP
Time:  expiresAt from API response

Display:
├─ "Code expires in 10:00"
├─ "Code expires in 9:59"
├─ ...
└─ "Code expires in 0:00"

When expires:
├─ Input disabled
├─ "Resend OTP" button enabled
└─ "OTP Expired" message shown

User clicks "Resend OTP":
├─ New request to POST .../resend
├─ New expiresAt received
├─ Countdown resets (10:00)
└─ Input cleared
```

### 8.2 JWT Token Countdown (5 minutes)

```
Start: User verifies OTP successfully
Time:  Frontend calculates: now + 5 minutes

Display:
├─ "Token expires in 5:00"
├─ "Token expires in 4:59"
├─ ...
└─ "Token expires in 0:00"

When expires:
├─ Form disabled
├─ "Token has expired" message
├─ User must start from step 1
└─ Cannot proceed to change password
```

---

## 9. Hooks (React Query Mutations)

### 9.1 Hook Definitions

```typescript
// File: src/hooks/use-auth.ts

// Step 1: Initiate forgot password
export const useInitiateForgotPassword = () => {
  return useMutation({
    mutationFn: (params: IInitiateForgotPasswordRequest) =>
      initiateForgotPassword(params),
    onSuccess: (data) => {
      // Store expireTime in zustand store
      useForgotPasswordStore.setState({
        expireTime: data.expiresAt
      })
    },
    onError: (error) => {
      // Error toast shown by global handler
    }
  })
}

// Step 2: Verify OTP
export const useVerifyOTPForgotPassword = () => {
  return useMutation({
    mutationFn: (params: IVerifyOTPForgotPasswordRequest) =>
      verifyOTPForgotPassword(params),
    onSuccess: (data) => {
      // Store JWT in zustand store
      useForgotPasswordStore.setState({
        token: data.token,
        tokenExpireTime: calculateExpireTime(5) // 5 minutes
      })
    }
  })
}

// Step 2A: Resend OTP
export const useResendOTPForgotPassword = () => {
  return useMutation({
    mutationFn: (params: IResendOTPForgotPasswordRequest) =>
      resendOTPForgotPassword(params),
    onSuccess: (data) => {
      // Reset countdown with new expireTime
      useForgotPasswordStore.setState({
        expireTime: data.expiresAt
      })
    }
  })
}

// Step 3: Change password
export const useConfirmForgotPassword = () => {
  return useMutation({
    mutationFn: (params: IConfirmForgotPasswordRequest) =>
      confirmForgotPassword(params),
    onSuccess: () => {
      // Clear store and navigate to login
      useForgotPasswordStore.getState().resetStore()
      navigate('/auth/login')
      showToast('Password reset successful')
    }
  })
}
```

### 9.2 Usage in Components

```typescript
// In forgot-password-by-email.tsx

const { mutate: initiate, isPending: isInitiating } =
  useInitiateForgotPassword()

const { mutate: verify, isPending: isVerifying } =
  useVerifyOTPForgotPassword()

const { mutate: resend, isPending: isResending } =
  useResendOTPForgotPassword()

const { mutate: confirm, isPending: isConfirming } =
  useConfirmForgotPassword()

// Handle step 1 submit
const handleInitiate = (email: string) => {
  initiate(
    {
      email,
      verificationMethod: 'email'
    },
    {
      onSuccess: (response) => {
        // response contains expiresAt
        // Hook handles store update
        setStep(2)  // Go to OTP input
      }
    }
  )
}

// Handle step 2 submit
const handleVerify = (code: string) => {
  verify(
    { code },
    {
      onSuccess: () => {
        setStep(3)  // Go to password reset
      }
    }
  )
}

// Handle step 3 submit
const handleConfirm = (newPassword: string) => {
  const { token } = useForgotPasswordStore()

  confirm(
    {
      newPassword,
      token
    },
    {
      onSuccess: () => {
        // Hook handles: clear store, navigate, toast
      }
    }
  )
}
```

---

## 10. Security Features

### 10.1 Rate Limiting

```
All forgot password endpoints:
├─ Limit: 3 requests per minute
├─ Per IP address
├─ Applies to all 4 endpoints:
│  ├─ /auth/forgot-password/initiate
│  ├─ /auth/forgot-password/resend
│  ├─ /auth/forgot-password/confirm
│  └─ /auth/forgot-password/change
└─ Response 429 if exceeded
```

### 10.2 Token Security

```
OTP Token:
├─ 6-character random uppercase
├─ Generated fresh each request
├─ Expires in 10 minutes
├─ One per user (prevents spam)
└─ Only valid once

JWT Token:
├─ Signed with secret
├─ Payload: { sub: userId, jti: tokenId }
├─ Expires in 5 minutes
├─ Used to verify password change
└─ Invalidated after use
```

### 10.3 Password Security

```
Password Hashing:
├─ Algorithm: bcrypt
├─ Salt rounds: configurable
├─ Hashed before storage
└─ Never stored in plain text

Password Requirements:
├─ Min 8 characters
├─ Max 20 characters
├─ Must contain letter
├─ Must contain number
└─ Enforced on frontend + backend
```

---

## 11. File Structure Reference

```
Frontend:
app/auth/
├─ forgot-password.tsx                    (Step 0: Method selection)
├─ forgot-password-by-email.tsx           (Steps 1-3: Email flow)
├─ forgot-password-by-phone.tsx           (Steps 1-3: Phone flow)

components/app/form/
├─ forgot-password-by-email-form.tsx      (Email input form)
├─ forgot-password-by-phone-form.tsx      (Phone input form)
├─ reset-password-form.tsx                (Password reset form)

components/app/input/
├─ password-with-rules-for-reset-input.tsx  (Password rules display)

stores/
├─ forgot-password.store.ts               (Zustand state)

api/
└─ auth.ts                                (API functions)

hooks/
└─ use-auth.ts                            (React Query mutations)

Backend:
auth/
├─ auth.controller.ts                     (4 endpoints)
├─ auth.service.ts                        (Business logic)
├─ auth.dto.ts                            (Request/Response DTOs)

entity/
└─ forgot-password-token.entity.ts        (Database model)
```

---

## 12. Success Flow

```
✅ Password Reset Success

Toast Message:
  "Password reset successful"

Actions:
  1. resetStore() - Clear all forgot password state
  2. Navigate to /auth/login
  3. Show success message

User can now:
  └─ Login with new password
```

---

## 13. Complete Message & i18n Keys

```
Translation namespace: auth & toast

auth:forgot-password.*
├─ .title
├─ .useEmail
├─ .usePhoneNumber
├─ .backButton
├─ .email
├─ .enterEmail
├─ .phoneNumber
├─ .enterPhoneNumber
├─ .send
├─ .verify
├─ .resendOTP
├─ .otpExpiresIn
├─ .otpExpired
├─ .tokenExpiresIn
├─ .tokenExpired
├─ .newPassword
├─ .enterNewPassword
├─ .confirmNewPassword
├─ .enterConfirmNewPassword
└─ .reset

toast.*
├─ .otpStillValid
├─ .sendVerifyEmailSuccess
├─ .sendVerifyPhoneNumberSuccess
├─ .verifyOTPSuccess
├─ .confirmForgotPasswordSuccess
├─ .forgotPasswordTokenNotExists
└─ ... (all error codes in api-endpoints-reference.md)
```

---

## 14. Summary Table

| Aspect | Details |
|--------|---------|
| **Methods** | Email or Phone Number |
| **OTP Validity** | 10 minutes |
| **JWT Validity** | 5 minutes |
| **Rate Limit** | 3 requests/minute per endpoint |
| **Password Rules** | 8-20 chars, letter + number required |
| **Public Route** | Yes, no authentication needed |
| **State Management** | Zustand store |
| **Form Validation** | react-hook-form + zod |
| **Multi-channel SMS** | Zalo OA (primary) + SMS (fallback) |
| **Database Hashing** | bcrypt |
| **JWT Signing** | HS256 |

---

## 15. Complete End-to-End Summary

```
┌────────────────────────────────────────────────────────┐
│ FORGOT PASSWORD COMPLETE FLOW                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 1. User clicks "Forgot Password" on login             │
│    └─ /auth/forgot-password                           │
│                                                        │
│ 2. Select method (Email or Phone)                     │
│    └─ Store: setVerificationMethod()                  │
│    └─ Navigate to appropriate flow                    │
│                                                        │
│ 3. Enter identifier (email/phone)                     │
│    └─ Form validation (format check)                  │
│    └─ API: POST .../initiate                          │
│    └─ Backend: Generate OTP, send via channel         │
│    └─ Frontend: Store expiresAt, start 10 min timer   │
│    └─ Step 2: Show OTP input                          │
│                                                        │
│ 4. Enter OTP (or resend if expired)                   │
│    └─ Display countdown timer                         │
│    └─ API: POST .../confirm (verify OTP)              │
│    └─ Backend: Verify code, generate JWT              │
│    └─ Frontend: Store JWT, start 5 min timer          │
│    └─ Step 3: Show password reset form                │
│                                                        │
│ 5. Enter new password with validation                 │
│    └─ Real-time rules feedback                        │
│    └─ Min 8, max 20 chars, letter, number             │
│    └─ Confirm password match                          │
│    └─ API: POST .../change (reset password)           │
│    └─ Backend: Hash password, save user, cleanup      │
│    └─ Frontend: Clear store, show success, redirect   │
│                                                        │
│ 6. Navigate to login & signin with new password       │
│    └─ /auth/login                                     │
│                                                        │
│ ✅ SUCCESS                                             │
│                                                        │
└────────────────────────────────────────────────────────┘
```
