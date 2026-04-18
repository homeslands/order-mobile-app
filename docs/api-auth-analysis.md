# API Authentication & Error Handling Analysis

Based on API endpoints documentation, here's the comprehensive breakdown for when auth/permission toasts should appear.

## 1. API Endpoint Categories

### 1.1 Public APIs (~31 endpoints)

No authentication required. Available to all users (logged-in or guest).

**Examples:**

- Auth flows: `POST /auth/login`, `POST /auth/register`, `POST /auth/forgot-password/*`
- Public menus: `GET /menu/specific/public`
- Public orders: `GET /orders/public`, `POST /orders/public`, `DELETE /orders/{slug}/public`
- Public vouchers: `POST /voucher/validate/public`, `GET /voucher/specific/public`
- Public payment: `POST /payment/initiate/public`
- Products/Catalogs: `GET /products`, `GET /catalogs`, `GET /menu-item/{slug}`
- Branches, Tables, Banners: All public GET endpoints

### 1.2 Authenticated APIs (~270+ endpoints)

Require valid Bearer token. Divided into:

**Standard Authenticated** (`✅`):

- User-owned resources: `GET /auth/profile`, `PATCH /auth/profile`
- Order management: `GET /orders`, `POST /orders`, `PATCH /orders/{slug}`
- Payment: `POST /payment/initiate`, `GET /invoice/specific`
- Vouchers (user): `POST /voucher/validate`, `GET /voucher/specific`
- User notifications: `GET /notification`

**Admin/Protected** (`✅*`):

- System management: User CRUD, Role management, System config
- Product/Menu management: Create/Update/Delete operations
- Staff-only: Chef area, Printer management
- Reports/Analytics: Revenue, Product analysis

### 1.3 Dual-Access Endpoints

Same endpoint works for both guest and authenticated users:

- `GET /orders/{slug}` → works for guest or authenticated user
- `POST /orders/{slug}/voucher` (has both public & auth versions)

---

## 2. Error Codes & When to Show Toast

### 2.1 401 Unauthorized

**HTTP 401** returned when:

- **No token provided** for authenticated endpoint
- **Token expired** and refresh fails
- **Invalid token** format

**When toast should show:**

- ❌ **NOT on app startup** for public endpoints (expected behavior)
- ✅ **Only when user explicitly tries an authenticated action** (e.g., viewing profile, creating order)
- ✅ **Then redirect to login** if refresh token also expired

**Example scenario:**

```
App startup → Cart validation calls /menu/specific/public ✅ (no auth needed)
User logs in → Auth token stored
User tries /orders → Gets 401 (token expired) → Show toast → Redirect to login
```

### 2.2 403 Forbidden

**HTTP 403** returned when:

- User **has valid token** but **lacks permission**
- Typical for admin-only endpoints

**When toast should show:**

- ✅ **Always show** - this is a legitimate user action that failed
- Format: "You don't have permission to do this" or specific reason
- User stays logged in (token is still valid)

**Example scenario:**

```
Manager tries to create new product → Has token but not admin role → 403
Show toast: "Only administrators can create products"
```

---

## 3. Current App Architecture Analysis

### 3.1 App Supports Both Guest & Authenticated Users ✅

- **Guest user**: No token, uses public endpoints
- **Authenticated user**: Has token, uses authenticated endpoints

### 3.2 Current Error Handling in `app/_layout.tsx`

```typescript
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipGlobalError) return // Skip if flagged
      const code = extractStatusCode(error)
      if (code) showErrorToast(code) // Show toast for any error
    },
  }),
  // ... similar for mutationCache
})
```

**Current behavior:** Shows toast for ALL errors (401, 403, 4xx, 5xx)

**Problem:** Shows "no permission" toast on startup when:

1. App loads (guest user, no token)
2. Cart validation calls `/menu/specific` (authenticated endpoint)
3. Returns 403 → Toast shows (but user never tried this action!)

### 3.3 Solution Implemented ✅

Cart validation already uses correct approach:

```typescript
const fetchMenu =
  hasUser && roleName !== Role.CUSTOMER
    ? getSpecificMenu // /menu/specific (authenticated)
    : getPublicSpecificMenu // /menu/specific/public (public)

// Suppress auth errors during silent validation
await queryClient.fetchQuery({
  queryKey,
  queryFn: () => fetchMenu(query),
  meta: { skipGlobalError: true }, // Don't show toast on network/auth failure
})
```

✅ **This is correct** because:

- Cart validation is internal, not user-initiated
- Guest users should silently fail without auth errors
- Menu fetch can retry later when user authenticates

---

## 4. Refined Error Handling Strategy

### 4.1 When to Show 401/403 Toasts

| Scenario                | Endpoint                | User                   | Toast                     | Action              |
| ----------------------- | ----------------------- | ---------------------- | ------------------------- | ------------------- |
| App startup             | `/menu/specific/public` | Guest                  | ❌ No                     | Load public menu    |
| App startup             | `/menu/specific`        | Auth but token expired | ❌ Skip (meta flag)       | Validate on refresh |
| User clicks "My Orders" | `/orders`               | No token               | ✅ Yes: "Login required"  | Redirect to login   |
| User clicks "My Orders" | `/orders`               | Token expired          | ✅ Yes: "Session expired" | Refresh & retry     |
| User creates product    | `/products` POST        | No admin role          | ✅ Yes: "No permission"   | Show dialog         |
| User views public order | `/orders/{slug}`        | Guest                  | ✅ Works!                 | Show order          |

### 4.2 Implementation Pattern

```typescript
// For USER-INITIATED actions → Show error toast
const handleUserProfileClick = async () => {
  try {
    const profile = await fetchProfile() // No skipGlobalError flag
    // 401 → Toast shows → User sees "Login required"
    // 403 → Toast shows → User sees "No permission"
  } catch (error) {
    // Global error handler shows toast
  }
}

// For SYSTEM/BACKGROUND actions → Suppress errors
const validateCartOnStartup = async () => {
  const result = await queryClient.fetchQuery({
    queryFn: () => getMenu(),
    meta: { skipGlobalError: true }, // Silent fail
  })
  // 401/403 → No toast → Cart still works with cached data
}
```

---

## 5. When NOT to Show Toast (skipGlobalError Use Cases)

These are internal operations where user didn't explicitly request the action:

1. **Cart validation** (auto-runs on startup & before order)
2. **Menu prefetching** (predictive data loading)
3. **Notifications polling** (background refresh)
4. **Image uploads** (optional, not blocking)
5. **Analytics events** (non-critical)

---

## 6. Current Implementation Status ✅

| Issue              | Status          | Details                                                                  |
| ------------------ | --------------- | ------------------------------------------------------------------------ |
| 401/403 on startup | **Fixed**       | Cart validation uses `skipGlobalError` flag + correct endpoint selection |
| Guest user support | **Working**     | Uses public endpoints (no auth needed)                                   |
| Auth user support  | **Working**     | Uses authenticated endpoints (with token)                                |
| Token refresh      | **Automatic**   | Interceptor handles 401 → refresh → retry                                |
| Permission errors  | **Shows toast** | User sees "no permission" when it actually matters                       |

---

## 7. Payment Page 404 Issue - RESOLVED ✅

### Root Cause

- Initially attempted to use `/orders/{slug}/public` endpoint for guest users
- But this endpoint doesn't exist on backend
- Backend: `/orders/{slug}` is **public endpoint** (no authentication required)

### Solution Implemented

Simplified to use single endpoint for both guest and authenticated users:

```typescript
// /orders/{slug} works for both guest and authenticated users
export const useOrderBySlug = (slug: string | null | undefined) => {
  const isValidSlug = !!slug?.trim()

  return useQuery({
    queryKey: ['order', slug],
    queryFn: () => getOrderBySlug(slug!), // Public endpoint, works for everyone
    enabled: isValidSlug,
    placeholderData: keepPreviousData,
  })
}
```

### Files Modified

- `api/order.ts`: Removed `getPublicOrderBySlug()` function (not needed)
- `hooks/use-order.ts`: Simplified `useOrderBySlug` hook to use single endpoint

---

## 8. Summary & Recommendations

✅ **Current approach is correct:**

- Use public endpoints for guest users
- Use authenticated endpoints for logged-in users
- Show 401/403 only for user-initiated actions
- Suppress errors for background/internal operations via `meta: { skipGlobalError: true }`

✅ **App is properly architected** to support both guest and authenticated flows

✅ **Payment page 403 issue fixed** - now uses correct endpoint based on login status

📋 **Next steps if needed:**

- Add user-friendly error messages for 401/403
- Distinguish between "login required" and "session expired"
- Implement graceful degradation for failed non-critical operations
