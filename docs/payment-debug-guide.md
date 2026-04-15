# Payment Page Debug Guide

Hướng dẫn chi tiết để debug lỗi 403 "không có quyền" khi vào trang thanh toán.

## 1. Cách Xem Logs

### 1.1 Android (via Metro)

```bash
# Terminal 1: Start Metro
npm start

# Terminal 2: Run app
npm run expo run:android

# Terminal 1 sẽ hiển thị logs
# Tìm dòng bắt đầu với: [HTTP Request], [HTTP Response], [HTTP Error]
```

**Nơi xem logs:**
- **Metro bundler output** - Tất cả logs sẽ hiển thị ở terminal đó
- Search: `[HTTP Request]` hoặc `[HTTP Response]` hoặc `[HTTP Error]`

### 1.2 iOS

```bash
npm start
npm run expo run:ios

# Logs hiển thị trong Xcode console hoặc Metro terminal
```

### 1.3 Web (If Available)

```bash
npm run expo start --web
# Mở DevTools (F12) → Console tab
```

---

## 2. Logs Chi Tiết - Bạn Sẽ Thấy Gì

### 2.1 Flow Bình Thường (Guest User)

```
[HTTP Request] {
  method: 'GET',
  url: '/orders/ABC123',
  hasToken: false,                    ← ⚠️ QUAN TRỌNG: no token
  timestamp: '2026-03-31T10:30:00Z'
}

[HTTP Response] {
  status: 200,
  url: '/orders/ABC123',
  code: 0,
  message: 'Success',
  timestamp: '2026-03-31T10:30:00Z'
}

[Payment Page] Loaded {
  orderSlug: 'ABC123',
  isLoggedIn: false,                  ← ✅ Đúng, guest không có token
  isPending: false,
  hasOrder: true,                     ← ✅ Lấy được order
  error: null
}
```

### 2.2 Flow Bị Lỗi 403 (What We're Debugging)

```
[HTTP Request] {
  method: 'GET',
  url: '/orders/ABC123',
  hasToken: false,                    ← ⚠️ No token
  timestamp: '2026-03-31T10:30:00Z'
}

[HTTP Error] {
  httpStatus: 403,                    ← ❌ FORBIDDEN
  apiCode: 403,
  apiMessage: 'Forbidden',
  url: '/orders/ABC123',              ← ❌ Endpoint sai!
  method: 'GET',
  hasToken: false,
  timestamp: '2026-03-31T10:30:00Z',
  fullError: {
    message: 'Request failed with status code 403',
    response: {
      code: 403,
      message: 'Forbidden',
      data: null
    }
  }
}

[Payment Page] Loaded {
  orderSlug: 'ABC123',
  isLoggedIn: false,
  isPending: false,
  hasOrder: null,                     ← ❌ Không lấy được order
  error: Error('Request failed...')
}
```

---

## 3. Phân Tích Logs - Tìm Lỗi

### 3.1 Kiểm Tra Endpoint Được Gọi

```typescript
// Xem log: url
// ❌ SĐÚNG nếu: /orders/ABC123 (authenticated endpoint)
// ✅ ĐÚNG nếu: /orders/ABC123/public (public endpoint)
```

**Nếu `url: '/orders/ABC123'` mà `hasToken: false` → BUG!**
- Phải dùng `/orders/ABC123/public` khi guest

### 3.2 Kiểm Tra Token

```typescript
// Xem log: hasToken
// ✅ Nếu guest: hasToken = false
// ✅ Nếu logged-in: hasToken = true

// ❌ Nếu isLoggedIn = true nhưng hasToken = false?
// → Token không được gửi đúng cách
```

### 3.3 Kiểm Tra Response

```typescript
// Nếu status: 403 → API reject (không có quyền)
// Có thể là:
// 1️⃣ Endpoint sai (dùng auth endpoint khi guest)
// 2️⃣ Token hết hạn (cần refresh)
// 3️⃣ API thay đổi behavior

// Nếu status: 401 → Token hết hạn/invalid
// → Sẽ tự động refresh (xem log [HTTP] Token refreshed)
```

---

## 4. Các Scenario & Cách Kiểm Tra

### Scenario A: Guest User Accessing Payment

**Expected Logs:**

```
[HTTP Request] { url: '/orders/ABC123', hasToken: false }
       ↓
[HTTP Response] { status: 200, code: 0 }
       ↓
[Payment Page] Loaded { isLoggedIn: false, hasOrder: true }
```

**Nếu thấy:**
```
[HTTP Request] { url: '/orders/ABC123', hasToken: false }
       ↓
[HTTP Error] { httpStatus: 403, ... }
```
→ **PROBLEM:** Dùng sai endpoint!

**Fix:** Kiểm tra `useOrderBySlug` hook có check `isLoggedIn` không?

---

### Scenario B: Logged-In User (Token Valid)

**Expected Logs:**

```
[HTTP Request] {
  url: '/orders/ABC123',
  hasToken: true,
  Authorization: 'Bearer <token>'
}
       ↓
[HTTP Response] { status: 200, code: 0 }
       ↓
[Payment Page] Loaded { isLoggedIn: true, hasOrder: true }
```

**Nếu thấy:**
```
[HTTP Request] { hasToken: true }
       ↓
[HTTP Error] { httpStatus: 401, ... }
       ↓
[HTTP] Token refresh failed
       ↓
[HTTP Error] { httpStatus: 403, ... }
```
→ **PROBLEM:** Token hết hạn, refresh fail

**Fix:** Check auth token trong store, có thể cần re-login

---

### Scenario C: Token Hết Hạn (Auto Refresh)

**Expected Logs:**

```
[HTTP Request] { url: '/orders/ABC123', hasToken: true }
       ↓
[HTTP Error] { httpStatus: 401, message: 'Unauthorized' }
       ↓
[HTTP] Token refreshed successfully
       ↓
[HTTP Request] { url: '/orders/ABC123', hasToken: true }
       ↓
[HTTP Response] { status: 200, code: 0 }
```

✅ **NORMAL** - Token tự động refresh, request retry, thành công

---

## 5. Detailed Check List

Khi bạn vào trang thanh toán, check theo thứ tự:

### ✅ Step 1: Xác Nhận URL Endpoint

```
Tìm log: [HTTP Request]
Kiểm tra: url field

Nếu guest (hasToken: false):
  ✅ Đúng: /orders/ABC123/public
  ❌ Sai: /orders/ABC123

Nếu logged-in (hasToken: true):
  ✅ Đúng: /orders/ABC123
  ❌ Sai: /orders/ABC123/public
```

### ✅ Step 2: Xác Nhận HTTP Status

```
Tìm log: [HTTP Response] hoặc [HTTP Error]

✅ 200 → Success
✅ 401 → Token expired (auto refresh, check next logs)
❌ 403 → Forbidden (endpoint sai hoặc permission denied)
❌ 404 → Order not found
```

### ✅ Step 3: Xác Nhận Login Status

```
Tìm log: [Payment Page] Loaded
Kiểm tra: isLoggedIn, hasOrder

✅ isLoggedIn = false, hasOrder = true
   → Guest access success ✅

✅ isLoggedIn = true, hasOrder = true
   → Logged-in access success ✅

❌ hasOrder = null
   → Order fetch failed, check error field
```

### ✅ Step 4: Kiểm Tra Error Details

```
Nếu có error:
  - Xem: error.message
  - Xem: error.response.code
  - Xem: error.response.message

Phổ biến:
  - 403 Forbidden → Endpoint sai
  - 401 Unauthorized → Token issue
  - 113000 → Menu item not found (khác issue)
```

---

## 6. Common Issues & Solutions

### ❌ Issue 1: `httpStatus: 403, url: '/orders/ABC123', hasToken: false`

**Problem:** Guest user đang dùng authenticated endpoint

**Solution:** Kiểm tra `useOrderBySlug` có chọn endpoint dúng không?

```typescript
// ❌ SAI
const useOrderBySlug = (slug: string) => {
  return useQuery({
    queryFn: () => getOrderBySlug(slug)  // ← Always authenticated
  })
}

// ✅ ĐÚNG
const useOrderBySlug = (slug: string) => {
  const isLoggedIn = !!useUserStore((s) => s.userInfo)
  return useQuery({
    queryFn: () =>
      isLoggedIn
        ? getOrderBySlug(slug)
        : getPublicOrderBySlug(slug)  // ← Use public for guest
  })
}
```

---

### ❌ Issue 2: `httpStatus: 401` → Token Refresh Fails

**Problem:** Token invalid, refresh token cũng hết hạn

**Solution:**
1. Force re-login: `logout()` → redirect `/auth/login`
2. Check token expiry: stored token vs current time
3. Clear cached tokens: check auth store

---

### ❌ Issue 3: `httpStatus: 403, hasToken: true` (Logged-In But Forbidden)

**Problem:** User không có quyền truy cập order này

**Solution:**
1. Check order ownership: API should verify user owns this order
2. Check user role: có đủ quyền để xem payment không?
3. Contact backend: có thể là API issue

---

## 7. How to Copy & Share Logs

### Khi cần report bug:

1. **Bật Console Logging** (mở DevTools / Metro)
2. **Vào trang thanh toán** → trigger error
3. **Copy logs:**
   ```
   [HTTP Request] {...}
   [HTTP Response] {...}
   [Payment Page] Loaded {...}
   ```
4. **Gửi logs** cho team debug

---

## 8. Tắt/Bật Logging

Logging tự động tắt khi release (`__DEV__ = false`)

**Để bật lại nếu cần:**

```typescript
// Trong utils/http.ts, replace __DEV__ check:

// ❌ Chỉ dev mode
if (__DEV__) { console.log(...) }

// ✅ Luôn bật (debug release)
if (true) { console.log(...) }
```

**Để tắt logging:**

```typescript
// ❌ Tắt hoàn toàn
if (false) { console.log(...) }

// ✅ Chỉ log error
if (__DEV__ || error) { console.log(...) }
```

---

## 9. Performance Impact

⚠️ **Logging có thể ảnh hưởng performance:**
- Mỗi request/response log vào console
- Console output chậm trên device thực
- Bật logging khi debug, tắt trước release

**Best Practice:**
```typescript
// Chỉ log critical errors
if (__DEV__ && httpStatus >= 400) {
  console.error('[HTTP Error]', ...)
}
```

---

## 10. Next Steps

Sau khi bạn chạy app và thấy logs:

1. **Share logs với team**
   - Hoặc dán vào GitHub issue
   - Hoặc gửi qua Slack/Discord

2. **Kiểm tra fix:**
   - Sửa endpoint selection (useOrderBySlug)
   - Re-test guest + logged-in flows
   - Verify logs show correct endpoints

3. **Verify in Production:**
   - Test trên real device
   - Test with slow network (DevTools throttling)
   - Test token expiry scenarios
