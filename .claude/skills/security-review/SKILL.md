---
name: security-review
description: Trigger when writing auth flows, payment screens, API interceptors, token handling, deep links, form validation, or any code that touches user credentials, financial data, or external input. Ensures OWASP Mobile Top 10 compliance and React Native-specific security patterns.
---

# Security Review

This project handles **financial transactions** (payments, orders) and **user PII** (email, phone, address). Security is non-negotiable in these areas.

## 1. Token & Credential Storage

### Rules

```ts
// ✅ Store tokens in SecureStore (encrypted, hardware-backed)
import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('access_token', token)
const token = await SecureStore.getItemAsync('access_token')

// ❌ NEVER store tokens in AsyncStorage (plaintext, accessible via adb backup)
await AsyncStorage.setItem('access_token', token)

// ❌ NEVER store tokens in Zustand without SecureStore persistence
// (in-memory is fine, persistence layer must be SecureStore)
```

### What to check

- `access_token`, `refresh_token` stored only in SecureStore
- No credentials hardcoded in source (`.env.local` is correct, never commit it)
- `EXPO_PUBLIC_*` vars are safe for client — backend secrets must NEVER use `EXPO_PUBLIC_` prefix
- Token not logged: `console.log(token)` is forbidden

---

## 2. API Security

### Request headers

```ts
// ✅ Token injected by interceptor only — never manually in component
// File: utils/http.ts handles this

// ❌ Never expose token in component code
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }, // ← wrong layer
})
```

### Sensitive data in URLs

```ts
// ❌ Sensitive data as query params (logged by servers, cached in history)
http.get(`/orders?userId=${userId}&cardLast4=${cardLast4}`)

// ✅ Sensitive data in request body
http.post('/orders/search', { userId, cardLast4 })
```

### What to check

- No `console.log` of API responses containing user data or tokens
- All payment-related endpoints use `POST`/`PUT`, not `GET` with sensitive params
- `publicRoutes` in `utils/http.ts` only includes truly public endpoints
- Error responses from API not directly shown to user (map to friendly messages)

---

## 3. Input Validation

### Zod schemas at boundaries

```ts
// ✅ All form inputs validated with Zod before sending to API
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// ❌ Raw user input passed directly to API
await login({ email: formEmail, password: formPassword }) // no validation
```

### Phone / Email verification

```ts
// ✅ Sanitize before display (XSS doesn't apply to RN Text, but good habit)
// ✅ Validate format server-side AND client-side
// ❌ Trust OTP input length only — validate the actual OTP value server-side
```

### What to check

- Every form that accepts user input has a Zod schema (`use-zod-form.ts`)
- OTP inputs validate digit-only and exact length
- Address / name fields have max length constraints
- Search inputs don't construct URLs or SQL (backend responsibility, but flag unsafe patterns)

---

## 4. Deep Link Security

```ts
// ✅ Validate all deep link params before use
// trendcoffee:///payment/ORDER_ID — ORDER_ID must be validated
const { order } = useLocalSearchParams<{ order: string }>()

// Validate before trusting
if (!order || !/^[a-zA-Z0-9_-]+$/.test(order)) {
  router.replace('/(tabs)/home')
  return
}

// ❌ Use raw deep link params without validation
const orderId = params.order // could be path traversal or injection
await fetchOrder(orderId)
```

### What to check

- All `useLocalSearchParams()` values validated before API calls
- Dynamic routes (`[order].tsx`, `[id].tsx`) sanitize params
- Deep link scheme `trendcoffee://` not exploitable to trigger payment flows without auth

---

## 5. Payment Screen Security

```ts
// ✅ Re-verify order ownership server-side before payment
// ✅ Payment result confirmed via server webhook, not just client callback
// ✅ Show only last 4 digits of card, never full number

// ❌ Trust client-side payment status exclusively
if (clientPaymentSuccess) {
  markOrderPaid() // server must confirm this
}

// ❌ Log payment data
console.log('Payment result:', paymentData) // may contain card info
```

### What to check

- `app/payment/[order].tsx` — order ID validated, belongs to current user
- Payment callback navigates only after server confirmation
- No card data stored in Zustand or AsyncStorage
- Payment error messages don't leak internal error codes to UI

---

## 6. Auth Flow Security

```ts
// ✅ Token refresh race condition handled (queue in-flight requests)
// Already implemented in utils/http.ts — verify it's correct

// ✅ Logout clears ALL persisted state
export function logout() {
  SecureStore.deleteItemAsync('access_token')
  SecureStore.deleteItemAsync('refresh_token')
  useAuthStore.getState().setLogout()
  useUserStore.getState().removeUserInfo()
  // also clear cart, order-flow, etc.
}

// ❌ Partial logout (only clears auth store, leaves user data)
```

### What to check

- Logout clears SecureStore + all Zustand stores with user data
- Failed login doesn't leak whether email exists (use generic error message)
- Password reset flow validates token expiry server-side
- Biometric auth (if added) falls back to PIN/password, not bypass

---

## 7. Environment Variables

```bash
# ✅ Safe for client (bundled into app, visible to users)
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=trend-coffee

# ❌ NEVER use EXPO_PUBLIC_ for secrets (they're embedded in the JS bundle)
EXPO_PUBLIC_STRIPE_SECRET_KEY=sk_live_...   # NEVER
EXPO_PUBLIC_DB_PASSWORD=...                 # NEVER

# ✅ Backend secrets stay on the server only
STRIPE_SECRET_KEY=sk_live_...  # server env var, not in app
```

### What to check

- `.env.local` not committed (in `.gitignore`)
- No `EXPO_PUBLIC_*` vars contain API secrets, private keys, or passwords
- Firebase config is public-safe (projectId, apiKey are fine — they're restricted by rules)

---

## Anti-Patterns Summary

| ❌ Don't                        | ✅ Do Instead                         |
| ------------------------------- | ------------------------------------- |
| Store token in AsyncStorage     | Use `expo-secure-store`               |
| Log tokens or payment data      | Remove all sensitive `console.log`    |
| Trust deep link params directly | Validate with regex + auth check      |
| Show raw API error to user      | Map to friendly message               |
| Hardcode secrets in source      | Use `.env.local` (non-`EXPO_PUBLIC_`) |
| Trust client payment callback   | Confirm via server webhook            |
| Partial logout                  | Clear SecureStore + all stores        |
| Sensitive data in GET params    | Use POST body                         |
