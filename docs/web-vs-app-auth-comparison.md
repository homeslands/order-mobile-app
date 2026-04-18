# Web vs App - Authentication Flow Comparison

## 1. Architecture Overview

### Web Auth Flow (From authentication-flow.md)

```
Login Page → useLogin() → Auth Store → User Store → Protected Routes
  ↓
  ├─ POST /auth/login
  ├─ Save tokens to localStorage
  ├─ Fetch user profile
  ├─ Token auto-refresh on expiry
  └─ ProtectedElement checks permissions
```

**Key Features:**

- ✅ Persistent localStorage (survives page reload)
- ✅ JWT decode for permissions extraction
- ✅ ProtectedElement wraps protected routes
- ✅ Auto-redirect if already authenticated
- ❌ **NO Guest User Support** (not mentioned in docs)
- ❌ **NO FCM** (not mentioned)

---

### App Auth Flow (Current State - React Native)

```
Guest User                          Logged-In User
    ↓                                   ↓
Browse Menu (public)          Login → Store tokens → FCM register
  ↓                                   ↓
Create Order (public)         Enhanced features (loyalty, delivery)
  ↓                                   ↓
Payment (public)              Full order management
  ↓
Guest checkout completed
```

**Key Features:**

- ✅ Supports BOTH guest & authenticated
- ✅ Guest: Can browse, order, checkout without login
- ✅ Auth: Full features + loyalty points + delivery
- ✅ Public endpoints work for everyone
- ✅ FCM support (currently only for auth users)
- ✅ Zustand persist (AsyncStorage on mobile)
- ❌ No ProtectedElement (routes allow guest access)

---

## 2. Detailed Comparison

### 2.1 Login & Authentication

| Aspect            | Web                                   | App                                   |
| ----------------- | ------------------------------------- | ------------------------------------- |
| **Login Flow**    | Phone + Password                      | Phone + Password                      |
| **Token Storage** | localStorage (persistent)             | Zustand + AsyncStorage (persistent)   |
| **Token Parts**   | accessToken, refreshToken, expireTime | accessToken, refreshToken, expireTime |
| **Auto Refresh**  | Request interceptor (auto)            | Request interceptor (auto)            |
| **Guest Support** | ❌ No                                 | ✅ Yes                                |
| **Auto-Redirect** | If already auth → skip login          | N/A (supports guest)                  |

---

### 2.2 Route Protection

#### Web:

```typescript
// Protected routes wrapped with ProtectedElement
<ProtectedElement requiredRoles={[Role.CUSTOMER]}>
  <ClientPage />
</ProtectedElement>

// Checks:
// 1. Is token valid?
// 2. Is user authenticated?
// 3. Does user have required role/permissions?
// 4. If NO → Redirect /login
```

#### App:

```typescript
// No route protection wrapper
// All routes accessible to guest users

// Order creation:
export const useCreateOrder = () => {
  return useMutation({
    mutationFn: POST / orders, // Authenticated endpoint
  })
}

export const useCreateOrderWithoutLogin = () => {
  return useMutation({
    mutationFn: POST / orders / public, // Public endpoint
  })
}

// App selects correct mutation based on isLoggedIn
```

---

### 2.3 Permission Checking

#### Web:

```typescript
// Extracts from JWT
const decoded = jwtDecode(token)
const permissions = decoded.authorities
// ["ROLE_STAFF", "PERMISSION_VIEW_ORDER", ...]

// ProtectedElement validates:
// - Role check (CUSTOMER vs STAFF)
// - Permission check (specific authorities)
// - Shows forbidden if no permission
```

#### App:

```typescript
// No JWT decoding
// Role from useUserStore only

const userInfo = useUserStore((s) => s.userInfo)
const role = userInfo?.role?.name // CUSTOMER, STAFF, ADMIN

// Uses role to determine:
// - Available features (loyalty points, delivery)
// - Available endpoints (public vs auth)
// - UI visibility (payment methods, order types)
```

---

### 2.4 Order Flow

#### Web (Implied - Auth Only):

```
User (Authenticated) →
  ├─ Browse menu (GET /menu/specific) - auth endpoint
  ├─ Create order (POST /orders) - auth endpoint
  ├─ Payment (POST /payment/initiate) - auth endpoint
  └─ Receive order confirmation
```

#### App:

```
Guest User →
  ├─ Browse menu (GET /menu/specific/public) - public
  ├─ Create order (POST /orders/public) - public
  ├─ Payment (POST /payment/initiate/public) - public
  └─ Checkout successful

Logged-In User →
  ├─ Browse menu (GET /menu/specific) - auth
  ├─ Create order (POST /orders) - auth
  ├─ Payment (POST /payment/initiate) - auth
  ├─ Get loyalty points
  ├─ Use delivery
  └─ View order history
```

---

### 2.5 FCM Notifications

#### Web:

```
Not mentioned in auth flow docs
Assume: Only authenticated users can receive notifications
```

#### App:

```
Current:
  - Logged-in: Register token → Can receive FCM ✅
  - Guest: No token registration → Cannot receive FCM ❌

Requested:
  - Guest: Also register token → Can receive FCM (WIP)
```

---

## 3. Token Management Comparison

### Web Token Flow

```
Login
  ↓
GET tokens + expireTime
  ↓
Store in localStorage (auth-storage key)
  ↓
Make request → Check if accessToken expired
  ├─ NO → Send request normally
  └─ YES → POST /auth/refresh
           ├─ Send: { accessToken, refreshToken }
           ├─ Get: { newAccessToken, newRefreshToken, ... }
           └─ Update store → Retry request
  ↓
401 error → Token refresh failed → Logout → Redirect /login
```

### App Token Flow

```
Login (or Guest)
  ↓
GET tokens + expireTime (if login)
  ↓
Store in Zustand → Persist to AsyncStorage
  ↓
Make request → Interceptor checks token expiry
  ├─ NO token (guest) → Send normally (no auth header)
  ├─ Token expired → POST /auth/refresh
  │  ├─ Send: { accessToken, refreshToken }
  │  ├─ Get: { newAccessToken, newRefreshToken, ... }
  │  └─ Update store → Retry request
  └─ Token valid → Add Authorization header
  ↓
401 error → Logout → Clear tokens → Stay on page (guest mode)
```

---

## 4. Key Differences Summary

| Feature                  | Web                   | App               | Status                |
| ------------------------ | --------------------- | ----------------- | --------------------- |
| **Guest Support**        | ❌                    | ✅                | App advantage         |
| **Public Endpoints**     | ❌ (all auth)         | ✅                | App requirement       |
| **JWT Permission Check** | ✅                    | ❌                | Web advantage         |
| **Route Protection**     | ✅ (ProtectedElement) | ❌                | Web advantage         |
| **FCM Notifications**    | ?                     | ⚠️ (limited)      | App needs enhancement |
| **Token Auto-Refresh**   | ✅                    | ✅                | Both equal            |
| **Persistent Storage**   | ✅ (localStorage)     | ✅ (AsyncStorage) | Both equal            |
| **Role-Based Features**  | Via JWT authorities   | Via userInfo.role | Both work             |

---

## 5. Issues & Recommendations

### 5.1 App-Specific Issues

#### ❌ FCM Only for Auth Users

**Current:** Guest cannot receive FCM notifications
**Fix Needed:** Create public endpoint or remove auth requirement
**Recommendation:** Implement `/notification/firebase/register-device-token/public`

#### ❌ No Route Protection

**Current:** No ProtectedElement wrapper
**Impact:** Guest users can access any route (relies on endpoint auth)
**Note:** OK for now since public endpoints handle guest

#### ❌ No JWT Permission Checking

**Current:** Role info from userStore, not from JWT
**Impact:** Limited permission granularity
**Trade-off:** Simpler but less flexible than web

---

### 5.2 Web Could Adopt From App

#### ✅ Guest User Support

**Web:** Only authenticated flow
**App:** Fully supports guest checkout
**Recommendation:** Web could add `/checkout/public` routes for guest users

#### ✅ Public Endpoints Pattern

**Web:** All endpoints require auth
**App:** Has public variants (`/public` suffix)
**Recommendation:** Web could mirror this pattern for flexibility

---

## 6. Current Auth Store Status

### Web (From docs):

```typescript
authStore: {
  token: string
  refreshToken: string
  expireTime: string
  expireTimeRefreshToken: string
  slug: string

  isAuthenticated(): boolean  // Checks token validity
  setLogout(): void
  // ... other methods
}

userStore: {
  userInfo: {
    id, slug, role, email, ...
  }
  setUserInfo()
  emailVerificationStatus
  phoneVerificationStatus
}
```

### App (Current):

```typescript
useUserStore: {
  userInfo: {
    role: { name: CUSTOMER | STAFF | ADMIN }
    branch?: { slug }
    ...
  }

  // No JWT decoding
  // Guest user: userInfo = null
}

useAuthStore: {
  // Auth tokens stored
  // Interceptor handles refresh
}
```

---

## 7. Conclusion

### Web Architecture:

- ✅ **Pros:** Strong route protection, JWT-based permissions, localStorage persistence
- ❌ **Cons:** No guest support, all endpoints require auth, no FCM

### App Architecture:

- ✅ **Pros:** Guest user support, public endpoints, designed for mobile persistence, FCM ready
- ❌ **Cons:** No ProtectedElement, simpler permission model, FCM limited to auth

### Recommendation:

**Keep app design as-is** - it's optimized for guest checkout flow.
**Enhancement needed:** Add public FCM endpoint for guest notifications.
