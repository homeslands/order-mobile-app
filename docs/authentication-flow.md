# Authentication Flow Documentation

## 1. Tổng Quan Architecture

```
┌─────────────────────────────────────────────────────────┐
│ USER INTERFACE                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │ Login Page / Register Page                  │       │
│  │ Forgot Password Page                        │       │
│  └─────────────────┬───────────────────────────┘       │
│                    │                                    │
│                    ▼                                    │
│  ┌─────────────────────────────────────────────┐       │
│  │ Auth Hooks (React Query)                    │       │
│  │ - useLogin()                                │       │
│  │ - useRegister()                             │       │
│  │ - useForgotPassword()                       │       │
│  └─────────────────┬───────────────────────────┘       │
│                    │                                    │
└────────────────────┼────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ HTTP LAYER (Axios)                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Request Interceptor                                    │
│  ├─ Check if token expired                            │
│  ├─ If yes: Queue request & refresh token             │
│  └─ Add Bearer token to header                         │
│                                                         │
│  Response Interceptor                                   │
│  ├─ Check 401 error                                   │
│  ├─ If yes: Refresh token & retry                     │
│  └─ Extract error code & show toast                    │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ BACKEND API ENDPOINTS                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  - POST /auth/login                                     │
│  - POST /auth/refresh                                   │
│  - POST /auth/forgot-password/...                      │
│  - GET /profile                                         │
│  - etc                                                  │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ STORE MANAGEMENT (Zustand)                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Auth Store (auth-storage)                             │
│  ├─ token                                              │
│  ├─ refreshToken                                       │
│  ├─ expireTime                                         │
│  └─ expireTimeRefreshToken                             │
│                                                         │
│  User Store (user-info)                                │
│  ├─ userInfo                                           │
│  └─ verification statuses                              │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ ROUTE PROTECTION                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ProtectedElement                                       │
│  ├─ Validate tokens                                    │
│  ├─ Check permissions                                  │
│  ├─ Show loading states                                │
│  └─ Render protected content                           │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PROTECTED PAGES                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  - /system/...  (Staff dashboard)                      │
│  - /client/...  (Customer pages)                       │
│  - /profile     (User profile)                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. User Login Flow

### 2.1 Login Process

```
[User navigates to /login]
     │
     ▼
[Check if already authenticated]
  ├─ Has valid token?
  ├─ Has valid userInfo?
  │
  ├─ YES → Auto-redirect to dashboard
  │        (Skip login form)
  │
  └─ NO → Show login form
          ├─ Phone number input
          ├─ Password input
          └─ Submit button
     │
     ▼
[User fills form & clicks Login]
     │
     ▼
[Call useLogin() mutation]
  → POST /auth/login
  {
    "phoneNumber": "0901234567",
    "password": "secretPassword"
  }
     │
     ▼
[Backend validates credentials]
     │
     ├─ INVALID → Return 401 + error code
     │            (e.g., 119010: invalidCredentials)
     │            Toast error shown automatically
     │
     └─ VALID → Return 200 + tokens
              {
                "accessToken": "eyJhbGc...",
                "refreshToken": "eyJhbGc...",
                "expireTime": "2026-03-31T10:30:00Z",
                "expireTimeRefreshToken": "2026-04-30T10:30:00Z",
                "user": {
                  "id": "user-123",
                  "slug": "user-abc",
                  ...
                }
              }
     │
     ▼
[Save tokens to Auth Store]
  authStore.setToken(accessToken)
  authStore.setRefreshToken(refreshToken)
  authStore.setExpireTime(expireTime)
  authStore.setExpireTimeRefreshToken(expireTimeRefreshToken)
  authStore.setSlug(slug)
     │
     ├─ Persisted to localStorage: auth-storage
     │
     ▼
[Fetch user profile]
  → Call useProfile() hook
  → GET /profile
     │
     ▼
[Save user info to User Store]
  userStore.setUserInfo(profileData)
  userStore.setEmailVerificationStatus(...)
  userStore.setPhoneVerificationStatus(...)
     │
     ├─ Persisted to localStorage: user-info
     │
     ▼
[Calculate redirect destination]
  ├─ Check role (CUSTOMER vs STAFF)
  ├─ Check permissions from JWT
  ├─ Check saved redirect URL
  ├─ Determine dashboard
  │
  └─ Default:
     ├─ STAFF → /system/dashboard
     └─ CUSTOMER → /home
     │
     ▼
[Navigate to destination]
  → Smart navigation prevents loops
  → Show dashboard to user
```

### 2.2 Auto-Redirect Logic (Already Authenticated)

```
[User already has valid token + userInfo]
     │
     ▼
[Login page mounts]
     │
     ▼
[Check isAuthenticated()]
  ├─ Token valid?
  ├─ Refresh token valid?
  ├─ User info loaded?
  │
  ├─ All YES → isAuthenticated = true
  │
  └─ Any NO → isAuthenticated = false
              (Show login form)
     │
     ▼
[If authenticated]
     │
     ├─ Extract role from JWT: jwtDecode(token)
     ├─ Check permissions in token.authorities[]
     │
     ▼
[Navigate to appropriate dashboard]
  ├─ Staff → /system/...
  └─ Customer → /client/...
     │
     ▼
[Prevent redirect loops]
  ├─ Don't redirect if already on destination
  ├─ Don't redirect if on /login page during auth flow
  └─ Use safeNavigate() utility
```

---

## 3. Token Management

### 3.1 Token Storage

| Item | Storage | Key | Format |
|------|---------|-----|--------|
| **Access Token** | localStorage | `auth-storage` → token | JWT string |
| **Refresh Token** | localStorage | `auth-storage` → refreshToken | JWT string |
| **Token Expiry** | localStorage | `auth-storage` → expireTime | ISO 8601 date |
| **Refresh Expiry** | localStorage | `auth-storage` → expireTimeRefreshToken | ISO 8601 date |

**Zustand Persist Middleware**:
```typescript
// All auth state auto-persisted to localStorage
const authStore = create(
  persist(
    (set) => ({ ... }),
    {
      name: 'auth-storage',  // localStorage key
      storage: localStorage,
      // Only persist these fields
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        expireTime: state.expireTime,
        expireTimeRefreshToken: state.expireTimeRefreshToken,
        slug: state.slug,
      })
    }
  )
)
```

### 3.2 Token Validation

```typescript
// Check if user is authenticated
isAuthenticated(): boolean {
  const now = moment()

  // Token validation
  if (!this.token) return false
  if (!this.expireTime) return false

  try {
    const tokenExpiry = moment(this.expireTime)
    if (now.isAfter(tokenExpiry)) {
      // Access token expired, check refresh token
      if (!this.refreshToken) return false
      if (!this.expireTimeRefreshToken) return false

      const refreshExpiry = moment(this.expireTimeRefreshToken)
      if (now.isAfter(refreshExpiry)) {
        // Both expired → not authenticated
        return false
      }

      // Refresh token still valid → can refresh
      return true
    }

    // Access token still valid
    return true
  } catch (error) {
    // moment.js parse error
    return false
  }
}

// Detailed token validation
isTokenValid(): boolean {
  // Returns true if:
  // - Access token not expired
  // - OR refresh token still valid (can refresh)

  // Returns false if:
  // - Both tokens expired
  // - No tokens at all
}
```

### 3.3 Token Refresh Flow

```
[Request to protected endpoint]
     │
     ▼
[Request Interceptor checks token expiry]
     │
     ├─ Token NOT expired → Continue normally
     │
     └─ Token expired BUT refresh token valid
          │
          ▼
          [Check if already refreshing]
            │
            ├─ NO → Start refresh
            │       ├─ Set isRefreshing = true
            │       ├─ POST /auth/refresh
            │       │  {
            │       │    "accessToken": currentToken,
            │       │    "refreshToken": currentRefreshToken
            │       │  }
            │       │
            │       ├─ Response:
            │       │  {
            │       │    "accessToken": newToken,
            │       │    "refreshToken": newRefreshToken,
            │       │    "expireTime": newExpireTime,
            │       │    "expireTimeRefreshToken": newExpireTimeRefresh
            │       │  }
            │       │
            │       ├─ Update all tokens in store
            │       ├─ Set isRefreshing = false
            │       └─ Retry queued requests with new token
            │
            └─ YES → Queue this request
                     (Wait for refresh to complete)
     │
     ▼
[Send request with new token]
  Authorization: Bearer <newAccessToken>
     │
     ▼
[Continue request normally]
```

### 3.4 Token Refresh Failure

```
[Token refresh fails]
     │
     └─ Error 401 or refresh API fails
        (Usually: refreshToken expired or invalid)
     │
     ▼
[AuthStore.setLogout()]
  ├─ Clear all tokens
  ├─ Clear user info
  └─ Set isRefreshing = false
     │
     ▼
[Navigate to /login]
     │
     ▼
[Save current URL for redirect after login]
  (So user returns to same page after re-login)
     │
     ▼
[Show toast: "Session expired"]
```

---

## 4. Route Protection & Authorization

### 4.1 Protected Element Component

```typescript
// File: protected-element.tsx

function ProtectedElement({ children, requiredRoles, requiredPermissions }) {

  1️⃣ Check Authentication State
  ├─ isRefreshing?
  │  └─ REFRESHING: Show spinner
  │
  ├─ !userInfo?
  │  ├─ loading? → LOADING: Show loading
  │  └─ yes → UNAUTHENTICATED: Redirect /login
  │
  └─ else → Check permissions

  2️⃣ Extract Permissions from JWT
  const decoded = jwtDecode(token)
  const permissions = decoded.authorities || []

  3️⃣ Permission Validation
  ├─ Role check:
  │  ├─ CUSTOMER: Block access to /system routes
  │  ├─ STAFF: Allow access (check specific permissions)
  │  └─ ADMIN: Full access
  │
  ├─ Permission check:
  │  ├─ If route requires specific permissions
  │  ├─ Check if any user permission matches
  │  ├─ If no match → Show forbidden page
  │  └─ If match → Render content
  │
  └─ Fallback:
     ├─ If route not found in permission config
     └─ Allow access (assume public)

  4️⃣ Render
  ├─ Show loading/spinner during REFRESHING/LOADING
  ├─ Show forbidden if permissions denied
  └─ Render children if all checks pass
}
```

### 4.2 Permission Extraction

```typescript
// From JWT token
{
  "iss": "auth-service",
  "sub": "user-123",
  "iat": 1704067200,
  "exp": 1704153600,
  "authorities": [
    "ROLE_STAFF",
    "PERMISSION_VIEW_ORDER",
    "PERMISSION_UPDATE_ORDER",
    "PERMISSION_VIEW_DASHBOARD",
    ...
  ]
}

// Extracted by:
const decoded = jwtDecode<TokenPayload>(token)
const permissions = decoded.authorities || []

// Validation:
const hasPermission = permissions.includes('PERMISSION_VIEW_ORDER')
```

### 4.3 Role-Based Access Control

```
┌──────────────────────────────────────────────┐
│ ROLE MATRIX                                  │
├──────────────┬────────┬─────────┬────────────┤
│ Route        │ Public │ Customer │ Staff     │
├──────────────┼────────┼──────────┼───────────┤
│ /login       │ ✅     │ ❌ redirect │ ❌ redirect│
│ /register    │ ✅     │ ❌       │ ❌         │
│ /forgot-pwd  │ ✅     │ ✅       │ ✅         │
│              │        │          │            │
│ /home        │ ❌     │ ✅       │ ❌ redirect│
│ /client/...  │ ❌     │ ✅       │ ❌ redirect│
│ /profile     │ ❌     │ ✅       │ ✅         │
│              │        │          │            │
│ /system/...  │ ❌     │ ❌       │ ✅*        │
│ /payment     │ ❌     │ ✅       │ ✅         │
│ /notification│ ❌     │ ✅       │ ✅         │
│              │        │          │            │
│ /settings    │ ❌     │ ❌       │ ✅*        │
└──────────────┴────────┴──────────┴────────────┘

* Requires specific permissions (VIEW_SETTINGS, etc)
```

---

## 5. Login/Register Page Behavior

### 5.1 Login Page Entry

```
[User navigates to /login]
     │
     ▼
[LoginPage.tsx mounts]
     │
     ▼
[Check if already authenticated]
     │
     ├─ YES (has token + userInfo)
     │  ├─ Extract role from token
     │  ├─ Extract permissions from token
     │  ├─ Calculate destination
     │  │  ├─ Role CUSTOMER → /client/...
     │  │  ├─ Role STAFF → /system/...
     │  │  └─ With permissions → specific page
     │  │
     │  └─ Navigate to destination (auto-redirect)
     │
     └─ NO → Show login form
             ├─ Phone number input
             ├─ Password input
             ├─ "Forgot Password?" link
             ├─ "Register" link
             └─ Submit button
```

### 5.2 Smart Navigation

```typescript
function calculateLoginRedirection() {

  // 1. Check saved redirect URL
  const savedRedirect = sessionStorage.getItem('redirectAfterLogin')
  if (savedRedirect && !savedRedirect.includes('/login')) {
    return savedRedirect
  }

  // 2. Extract role from JWT
  const decoded = jwtDecode(token)
  const role = decoded.authorities?.[0]  // e.g., ROLE_STAFF

  // 3. Determine default destination
  if (role?.includes('STAFF')) {
    return '/system/dashboard'
  } else {
    return '/client/home'
  }

  // 4. With permissions, can target specific page
  // e.g., if has PERMISSION_VIEW_ORDERS → /system/orders

  // 5. Safe navigation (prevent loops)
  if (destination === currentPage) {
    return currentPage  // Already there
  }
  return destination
}
```

### 5.3 Login Form Flow

```
┌──────────────────────────────────────┐
│ LOGIN FORM SUBMISSION                │
├──────────────────────────────────────┤
│                                      │
│  1. Input Validation (Client-side)   │
│     ├─ Phone not empty               │
│     ├─ Valid phone format            │
│     ├─ Password not empty            │
│     └─ Show inline errors if invalid │
│                                      │
│  2. Form Submit                      │
│     ├─ Disable submit button         │
│     ├─ Show loading spinner          │
│     │                                │
│     └─ Call useLogin(phone, password)│
│        → Mutation starts             │
│                                      │
│  3. API Call                         │
│     ├─ POST /auth/login              │
│     │  {                             │
│     │    phoneNumber,                │
│     │    password                    │
│     │  }                             │
│     │                                │
│     └─ Wait for response             │
│                                      │
│  4. Response Handling                │
│                                      │
│     ✅ SUCCESS:                      │
│     ├─ Save tokens to store          │
│     ├─ Fetch user profile            │
│     ├─ Navigate to dashboard         │
│     ├─ Reset form                    │
│     └─ Show success toast            │
│                                      │
│     ❌ ERROR:                        │
│     ├─ Show error toast              │
│     │  (auto-mapped from statusCode) │
│     ├─ Clear sensitive inputs        │
│     ├─ Re-enable submit button       │
│     └─ User can retry               │
│                                      │
│  5. Common Errors                    │
│     ├─ 119010: Invalid Credentials   │
│     ├─ 119033: Account Disabled      │
│     ├─ 119035: Phone Not Verified    │
│     ├─ 429: Too many attempts (rate) │
│     └─ 401/403: Authorization errors │
│                                      │
└──────────────────────────────────────┘
```

---

## 6. Logout Flow

### 6.1 Logout Process

```
[User clicks "Logout" button]
     │
     ▼
[Call authStore.setLogout()]
  ├─ token = undefined
  ├─ refreshToken = undefined
  ├─ expireTime = undefined
  ├─ expireTimeRefreshToken = undefined
  ├─ slug = undefined
  ├─ isRefreshing = false
  └─ authorities = []
     │
     ├─ Cleared from localStorage (auth-storage)
     │
     ▼
[Clear user store]
  userStore.removeUserInfo()
  ├─ userInfo = null
  ├─ emailVerificationStatus = null
  ├─ phoneNumberVerificationStatus = null
  └─ Cleared from localStorage (user-info)
     │
     ▼
[Clear cart data]
  clearCart()
     │
     ▼
[Save current URL (optional)]
  sessionStorage.setItem('redirectAfterLogin', currentURL)
  → User returns here after re-login
     │
     ▼
[Navigate to /login]
     │
     ▼
[Show toast message]
  Toast: "Session ended. Please login again."
  (or auto-shown: "Session expired")
```

### 6.2 Auto-Logout Scenarios

```
1️⃣ Token Expired
   - Access token expired
   - Refresh token expired
   - Can't refresh → Logout automatically

2️⃣ Token Refresh Failed
   - POST /auth/refresh returns 401
   - Usually: refresh token invalid/expired
   - Trigger logout

3️⃣ API Returns 401
   - Protected endpoint returns 401
   - Token became invalid on server
   - Logout and redirect to login

4️⃣ Manual Logout
   - User clicks logout button
   - Immediate logout

5️⃣ No Refresh Token
   - Access token expired
   - No refresh token to refresh with
   - Logout automatically
```

---

## 7. Registration & Email Verification Flow

### 7.1 Registration Process

```
[User navigates to /register]
     │
     ▼
[Show registration form]
  ├─ Phone number
  ├─ Password
  ├─ Confirm password
  ├─ First name
  ├─ Last name
  └─ Accept terms checkbox
     │
     ▼
[User fills form & submits]
     │
     ▼
[Client validation]
  ├─ All fields required?
  ├─ Phone valid format?
  ├─ Password strong enough?
  ├─ Passwords match?
  ├─ Terms accepted?
  └─ Show errors if validation fails
     │
     ▼
[POST /auth/register]
  {
    "phoneNumber": "0901234567",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }
     │
     ▼
[Backend validation]
  ├─ Phone not already registered? (119005: userExists)
  ├─ Phone format valid? (119000: invalidPhoneNumber)
  ├─ Password valid? (119001: invalidPassword)
  └─ Names valid? (119002/119003: invalid names)
     │
     ├─ FAILURE → Return error code
     │            Toast error shown
     │
     └─ SUCCESS → Create user
                  Return tokens
                  (Similar to login response)
     │
     ▼
[Save tokens to store]
  (Same as login flow)
     │
     ▼
[Fetch user profile]
  (Same as login flow)
     │
     ▼
[Navigate to dashboard]
  OR
[Redirect to email verification]
  (If email verification required)
```

### 7.2 Email Verification Flow

```
[User registered successfully]
     │
     ├─ Email verification required?
     │  └─ Redirect to /verify-email page
     │
     ▼
[Show email verification page]
  ├─ Display: "Check your email"
  ├─ Show masked email: "j***@gmail.com"
  ├─ Option: "Resend verification email"
  └─ Option: "Change email"
     │
     ▼
[User clicks link in email]
  → Link format: /verify-email?token=ABC123&code=XYZ
     │
     ▼
[Frontend parses token/code from URL]
     │
     ▼
[POST /auth/confirm-email-verification/code]
  {
    "token": tokenFromURL,
    "code": codeFromURL
  }
     │
     ▼
[Backend validates code]
  ├─ Code matches token? (119018: tokenNotFound)
  ├─ Code not expired? (119019: tokenExpired)
  └─ Code not already used?
     │
     ├─ FAILURE → Show error page
     │            Option: "Resend email"
     │
     └─ SUCCESS → Mark email as verified
                  Redirect to dashboard
                  Show success message
                  (119020: Error confirming still shows)
```

---

## 8. Phone Verification Flow

### 8.1 Initiate Phone Verification

```
[User wants to verify phone number]
     │
     ▼
[Navigate to /verify-phone or verify-phone-number]
     │
     ▼
[POST /auth/initiate-verify-phone-number]
  {
    "phoneNumber": "0901234567"
  }
     │
     ▼
[Backend sends OTP via SMS]
  └─ OTP expires in typically 5-10 minutes
     │
     ▼
[UI shows OTP input form]
  ├─ Input field for 4-6 digit code
  ├─ Timer showing expiry countdown
  ├─ "Resend OTP" button (disabled until timer expires)
  └─ "Change phone number" link
     │
     ▼
[User enters OTP from SMS]
     │
     ▼
[POST /auth/confirm-phone-number-verification/code]
  {
    "code": "123456"
  }
     │
     ▼
[Backend validates OTP]
  ├─ Code matches? (119030: tokenNotFound)
  ├─ Code not expired? (No explicit error)
  └─ Code not already used?
     │
     ├─ FAILURE → Show error
     │            Option: Retry or Resend
     │
     └─ SUCCESS → Mark phone as verified
                  Redirect to dashboard
                  Show success message
```

### 8.2 Resend OTP

```
[Timer expires or user clicks "Resend"]
     │
     ▼
[POST /auth/resend-verify-phone-number]
  {
    "phoneNumber": "0901234567"
  }
     │
     ▼
[Backend sends new OTP via SMS]
  └─ Reset expiry timer
     │
     ▼
[UI resets form]
  ├─ Clear OTP input
  ├─ Restart countdown timer
  └─ Disable "Resend" button until timer expires
     │
     ▼
[User enters new OTP and confirms]
```

---

## 9. Forgot Password Flow

### 9.1 Forgot Password Entry

```
[User clicks "Forgot Password?" on login page]
     │
     ▼
[Navigate to /forgot-password]
     │
     ▼
[Show method selector]
  ├─ Option 1: "Recover via Email"
  │  └─ Click → /forgot-password-by-email
  │
  └─ Option 2: "Recover via Phone"
     └─ Click → /forgot-password-by-phone
```

### 9.2 Email-Based Password Recovery

```
[/forgot-password-by-email page]
     │
     ▼
[Step 1: Enter email]
  ├─ User enters email
  ├─ Click "Send Recovery Email"
  │
  └─ POST /auth/forgot-password/initiate
     {
       "email": "user@example.com"
     }
       │
       ├─ Errors:
       │  ├─ 119016: emailAlreadyExists (or no user found)
       │  ├─ 119017: emailTokenExists (token already issued)
       │  └─ 119022: invalidEmail
       │
       └─ Success: Email sent
                   Redirect to step 2
     │
     ▼
[Step 2: Check email]
  ├─ Display: "Check your email"
  ├─ Show masked email: "j***@example.com"
  ├─ Option: "Resend email"
  └─ Option: "Use phone instead"
     │
     ▼
[User clicks link in email]
  → Link: /forgot-password-reset?token=ABC123
     │
     ▼
[Step 3: Set new password]
  ├─ Input new password
  ├─ Confirm password
  ├─ Click "Reset Password"
  │
  └─ POST /auth/forgot-password/change
     {
       "token": tokenFromEmail,
       "newPassword": "NewSecurePass123!"
     }
       │
       ├─ Errors:
       │  ├─ 119008: forgotTokenExpired
       │  ├─ 119001: invalidPassword
       │  └─ 119038: forgotPasswordTokenNotExists
       │
       └─ Success: Password changed
                   Redirect to /login
                   Show: "Password reset successful"
```

### 9.3 Phone-Based Password Recovery

```
[/forgot-password-by-phone page]
     │
     ▼
[Step 1: Enter phone]
  ├─ User enters phone number
  ├─ Click "Send OTP"
  │
  └─ POST /auth/forgot-password/initiate
     {
       "phoneNumber": "0901234567"
     }
       │
       ├─ Errors:
       │  ├─ 119009: forgotPasswordTokenExists
       │  ├─ 119000: invalidPhoneNumber
       │  └─ 119038: tokenNotExists
       │
       └─ Success: OTP sent via SMS
     │
     ▼
[Step 2: Enter OTP]
  ├─ User enters 4-6 digit code from SMS
  ├─ Timer showing expiry
  ├─ "Resend OTP" button
  │
  └─ POST /auth/forgot-password/confirm
     {
       "code": "123456"
     }
       │
       ├─ Errors:
       │  └─ 119008: forgotTokenExpired
       │
       └─ Success: OTP verified
                   Proceed to step 3
     │
     ▼
[Step 3: Set new password]
  ├─ Input new password
  ├─ Confirm password
  ├─ Click "Reset Password"
  │
  └─ POST /auth/forgot-password/change
     {
       "code": "123456",  // From OTP
       "newPassword": "NewSecurePass123!"
     }
       │
       ├─ Errors:
       │  └─ Similar to email flow
       │
       └─ Success: Password changed
                   Redirect to /login
```

---

## 10. Auth Hooks Reference

### 10.1 Login/Register Hooks

```typescript
// Login
const { mutate: login, isLoading, error } = useLogin()

login(
  { phoneNumber, password },
  {
    onSuccess: (data) => {
      // Auto-handled: tokens saved, profile fetched
      // Manual: navigation if needed
    },
    onError: (error) => {
      // Error auto-shown as toast
      // Manual handling for specific codes if needed
    }
  }
)

// Register
const { mutate: register } = useRegister()

register(
  { phoneNumber, password, firstName, lastName },
  {
    onSuccess: () => { /* ... */ },
    onError: () => { /* auto toast */ }
  }
)
```

### 10.2 Password Reset Hooks

```typescript
// Initiate (email or phone)
const { mutate: initiate } = useInitiateForgotPassword()

// Verify OTP
const { mutate: verifyOTP } = useVerifyOTPForgotPassword()

// Resend OTP
const { mutate: resendOTP } = useResendOTPForgotPassword()

// Confirm new password
const { mutate: confirm } = useConfirmForgotPassword()
```

### 10.3 Verification Hooks

```typescript
// Email verification
const { mutate: initiateEmail } = useVerifyEmail()
const { mutate: confirmEmail } = useConfirmEmailVerification()
const { mutate: resendEmail } = useResendEmailVerification()

// Phone verification
const { mutate: initiatePhone } = useVerifyPhoneNumber()
const { mutate: confirmPhone } = useConfirmPhoneNumberVerification()
const { mutate: resendPhone } = useResendPhoneNumberVerification()
```

### 10.4 Profile Hooks

```typescript
// Fetch profile
const { data: profile, isLoading } = useProfile()

// Update profile
const { mutate: updateProfile } = useUpdateProfile()

// Update password
const { mutate: updatePassword } = useUpdatePassword()

// Upload avatar
const { mutate: uploadAvatar } = useUploadProfilePicture()
```

---

## 11. Auth Store API

### 11.1 Auth Store Methods

```typescript
// File: auth.store.ts

interface IAuthStore {
  // State
  slug?: string
  token?: string
  refreshToken?: string
  expireTime?: string
  expireTimeRefreshToken?: string
  authorities?: string[]
  isRefreshing?: boolean

  // Methods

  // ✅ Check authentication
  isAuthenticated(): boolean
  isTokenValid(): boolean
  getAuthState(): AuthState  // AUTHENTICATED | LOADING | REFRESHING | EXPIRED | UNAUTHENTICATED
  needsUserInfo(): boolean

  // ✅ Set tokens
  setToken(token: string): void
  setRefreshToken(refreshToken: string): void
  setExpireTime(expireTime: string): void
  setExpireTimeRefreshToken(expireTime: string): void
  setSlug(slug: string): void
  setAuthorities(authorities: string[]): void

  // ✅ Logout
  setLogout(): void

  // ✅ Refresh state
  setIsRefreshing(isRefreshing: boolean): void

  // ✅ Get state
  getAuthState(): AuthState
}

// Usage in components
const { token, isAuthenticated, setLogout } = useAuthStore()
```

### 11.2 User Store Methods

```typescript
// File: user.store.ts

interface IUserStore {
  // State
  userInfo: IUserInfo | null
  deviceToken: string | null
  emailVerificationStatus: VerificationStatus | null
  phoneNumberVerificationStatus: VerificationStatus | null
  isVerifyingEmail: boolean
  isVerifyingPhoneNumber: boolean

  // Methods

  // ✅ Set user info
  setUserInfo(userInfo: IUserInfo): void
  removeUserInfo(): void

  // ✅ Set device token (for notifications)
  setDeviceToken(token: string): void
  removeDeviceToken(): void

  // ✅ Set verification status
  setEmailVerificationStatus(status: VerificationStatus): void
  removeEmailVerificationStatus(): void
  setPhoneNumberVerificationStatus(status: VerificationStatus): void
  removePhoneNumberVerificationStatus(): void

  // ✅ Set verification loading
  setIsVerifyingEmail(loading: boolean): void
  setIsVerifyingPhoneNumber(loading: boolean): void
}

// Usage in components
const { userInfo, setUserInfo, removeUserInfo } = useUserStore()
```

---

## 12. API Endpoints Summary

### 12.1 Authentication Endpoints

| Endpoint | Method | Purpose | Params |
|----------|--------|---------|--------|
| `/auth/login` | POST | Login with credentials | phoneNumber, password |
| `/auth/register` | POST | Create new account | phoneNumber, password, firstName, lastName |
| `/auth/refresh` | POST | Refresh token pair | accessToken, refreshToken |

### 12.2 Password Recovery Endpoints

| Endpoint | Method | Purpose | Params |
|----------|--------|---------|--------|
| `/auth/forgot-password/initiate` | POST | Start password reset | email OR phoneNumber |
| `/auth/forgot-password/confirm` | POST | Verify OTP code | code |
| `/auth/forgot-password/resend` | POST | Resend OTP | N/A |
| `/auth/forgot-password/change` | POST | Set new password | token/code, newPassword |

### 12.3 Email Verification Endpoints

| Endpoint | Method | Purpose | Params |
|----------|--------|---------|--------|
| `/auth/initiate-verify-email` | POST | Start email verification | email |
| `/auth/confirm-email-verification/code` | POST | Verify email code | token, code |
| `/auth/resend-verify-email` | POST | Resend verification | email |

### 12.4 Phone Verification Endpoints

| Endpoint | Method | Purpose | Params |
|----------|--------|---------|--------|
| `/auth/initiate-verify-phone-number` | POST | Send OTP to phone | phoneNumber |
| `/auth/confirm-phone-number-verification/code` | POST | Verify phone OTP | code |
| `/auth/resend-verify-phone-number` | POST | Resend OTP | phoneNumber |

### 12.5 User/Profile Endpoints

| Endpoint | Method | Purpose | Params |
|----------|--------|---------|--------|
| `/profile` | GET | Get current user | N/A |
| `/user/{slug}` | PATCH | Update user info | firstName, lastName, etc |
| `/user/{slug}/reset-password` | POST | Admin reset password | newPassword |

---

## 13. Error Codes (Auth-Related)

| Code | Message Key | Meaning |
|------|-------------|---------|
| `119000` | `toast.invalidPhoneNumber` | Phone number format invalid |
| `119001` | `toast.invalidPassword` | Password not strong enough |
| `119002` | `toast.invalidFirstName` | First name invalid |
| `119003` | `toast.invalidLastName` | Last name invalid |
| `119004` | `toast.invalidUserId` | User ID invalid |
| `119005` | `toast.userExists` | User already registered |
| `119006` | `toast.userNotFound` | User doesn't exist |
| `119007` | `toast.invalidOldPassword` | Current password wrong |
| `119008` | `toast.forgotTokenExpired` | Password reset token expired |
| `119009` | `toast.forgotPasswordTokenExists` | Reset already in progress |
| `119010` | `toast.invalidCredentials` | Username/password incorrect |
| `119014` | `toast.invalidDob` | Date of birth invalid |
| `119016` | `toast.emailAlreadyExists` | Email already registered |
| `119017` | `toast.emailTokenExists` | Email verification in progress |
| `119018` | `toast.emailTokenNotFound` | Email verification token invalid |
| `119019` | `toast.emailTokenExpired` | Email verification token expired |
| `119020` | `toast.errorWhenConfirmEmailVerification` | Error confirming email |
| `119021` | `toast.emailAlreadyExists` | (duplicate) |
| `119022` | `toast.invalidEmail` | Email format invalid |
| `119027` | `toast.verifyPhoneNumberTokenExists` | Phone verification in progress |
| `119030` | `toast.verifyPhoneNumberTokenNotFound` | Phone verification token invalid |
| `119033` | `toast.accountDisabled` | Account disabled by admin |
| `119035` | `toast.userPhoneNumberNotVerified` | Phone not verified |
| `119038` | `toast.forgotPasswordTokenNotExists` | No reset in progress |

---

## 14. Security Features

✅ **Token Encryption**
- JWTs signed by backend
- Can't be modified without signature breaking

✅ **Token Expiration**
- Access token: Short expiry (typically 1 hour)
- Refresh token: Long expiry (typically 30 days)
- Automatic refresh before expiration

✅ **Secure Storage**
- Tokens in localStorage (with Zustand persist)
- Not in sessionStorage (survives page reload)
- Not in cookies (no XSS from scripts)

✅ **Request Protection**
- Bearer token in Authorization header
- Token validation on every request
- Refresh on token expiry

✅ **Error Handling**
- Invalid token → redirect to login
- Expired token → auto-refresh or logout
- Failed refresh → logout immediately

✅ **CORS & Credentials**
- CORS enabled for authenticated requests
- Credentials sent with requests
- Server validates CORS origin

✅ **Permission Validation**
- Permissions stored in JWT
- Decoded on client for routing
- Backend validates again on API calls

---

## 15. Loading States

```typescript
// Auth Loading States
enum AuthState {
  AUTHENTICATED,     // ✅ User fully authenticated, userInfo loaded
  LOADING,           // ⏳ Has token, fetching userInfo
  REFRESHING,        // 🔄 Token being refreshed
  EXPIRED,           // ❌ Token expired, can't refresh
  UNAUTHENTICATED    // ❌ No valid tokens
}

// UI Behavior:
const state = authStore.getAuthState()

if (state === 'REFRESHING') {
  return <Spinner />  // Show loading spinner
}

if (state === 'LOADING') {
  return <LoadingPage />  // Show loading page
}

if (state === 'UNAUTHENTICATED') {
  return <Redirect to="/login" />  // Redirect
}

return <Children />  // Render protected content
```

---

## 16. Troubleshooting Guide

### Issue: User always redirected to login

```
Possible causes:
1. Token expired
   → Check expireTime in auth-storage
   → Try login again

2. Refresh token expired
   → Both tokens expired
   → Must login again

3. Server invalidated token
   → Token was valid locally but rejected by server
   → Logout user

4. Corrupted token data in localStorage
   → Clear auth-storage from DevTools
   → Refresh page and login again
```

### Issue: Token refresh loop

```
Possible causes:
1. Refresh token also expired
   → Logout user automatically
   → Redirect to login

2. Server rejects refresh
   → Logout user
   → Check error from /auth/refresh
   → Ask user to login again

3. Isrefreshing flag stuck true
   → Clear localStorage
   → Hard refresh page (Ctrl+Shift+R)
```

### Issue: User info not loading

```
Possible causes:
1. useProfile() failing
   → Check network error
   → Show error toast
   → Allow user to retry

2. User store not persisting
   → Check localStorage: user-info
   → Reload page to verify persistence

3. User deleted/disabled
   → Server returns 404 or 401
   → Logout user automatically
```

---

## 17. Best Practices

✅ **DO:**
- Always use `useLogin()` and `useRegister()` hooks instead of manual API calls
- Check `isAuthenticated()` before accessing protected resources
- Use `ProtectedElement` to wrap protected routes
- Handle token refresh transparently (it's automatic)
- Save redirect URL before logout for re-login

❌ **DON'T:**
- Manually extract token from localStorage (use store)
- Bypass `ProtectedElement` and route guards
- Try to refresh token manually (it's automatic)
- Forget to call `setLogout()` on logout
- Assume token is valid without checking expiry

---

## 18. Summary Diagram

```
┌─────────────────────────────────────────────────────────┐
│ AUTHENTICATION SYSTEM OVERVIEW                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  LOGIN                                                  │
│  ├─ Phone + Password → API                             │
│  ├─ Receive tokens (access + refresh)                  │
│  ├─ Store in Zustand (persisted to localStorage)       │
│  ├─ Fetch user profile                                 │
│  └─ Navigate to dashboard                              │
│                                                         │
│  TOKEN MANAGEMENT                                       │
│  ├─ Access token: 1 hour expiry                        │
│  ├─ Refresh token: 30 days expiry                      │
│  ├─ Auto-refresh before expiration                     │
│  ├─ Queue failed requests during refresh               │
│  └─ Logout on refresh failure                          │
│                                                         │
│  ROUTE PROTECTION                                       │
│  ├─ ProtectedElement validates tokens                  │
│  ├─ Extract permissions from JWT                       │
│  ├─ Check role-based access                            │
│  ├─ Show loading states                                │
│  └─ Redirect if not authenticated                      │
│                                                         │
│  LOGOUT                                                 │
│  ├─ Clear all tokens from store                        │
│  ├─ Clear user info                                    │
│  ├─ Save redirect URL                                  │
│  └─ Redirect to login                                  │
│                                                         │
│  REGISTRATION & VERIFICATION                           │
│  ├─ Register with phone + password                     │
│  ├─ Verify email/phone with OTP                        │
│  ├─ Recover password via email/phone                   │
│  └─ Change password when logged in                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
