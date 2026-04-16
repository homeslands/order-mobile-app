# Payment Status Detector — Design Spec

**Branch:** `feature/TCA-3-Analysis-Optimization-Firebase-Cloud-Messaging-for-Payment-Flow`
**Date:** 2026-04-16
**Scope:** BANK_TRANSFER (QR) and POINT (xu) payment methods only.

---

## Problem Statement

`PaymentPageContent` (`app/payment/[order].tsx`) mixes success-detection logic directly into the component:

| Issue | Impact |
|---|---|
| Polling fixed 10s → 90 API calls/15-min session | Unnecessary server load |
| Polling interval không cancel khi FCM arrive | Double-fetch mỗi lần thanh toán QR |
| POINT: toast thành công trước, UI chuyển sau ~500ms | User thấy toast nhưng screen chưa đổi → confusing |
| POINT: nếu `refetchOrder` fail → `showSuccess` không bao giờ `true` | User stuck |
| FCM + polling có thể cùng fire → 2 concurrent `refetchOrder` | Race condition nhẹ |

---

## Goal

Extract toàn bộ success-detection logic ra hook `usePaymentStatusDetector`. Component chỉ nhận `showSuccess: boolean`, không biết chi tiết FCM/polling/optimistic.

---

## Architecture

### Files

| File | Action | Responsibility |
|---|---|---|
| `hooks/use-payment-status-detector.ts` | **Create** | Tất cả success-detection logic |
| `hooks/index.ts` | **Modify** | Export hook mới |
| `app/payment/[order].tsx` | **Modify** | Xóa ~45 lines inline logic, dùng hook |
| `__tests__/hooks/use-payment-status-detector.test.ts` | **Create** | Unit tests cho hook |

### Dependency flow

```
PaymentPageContent
  └── usePaymentStatusDetector({ orderSlug, method, submittedAt, orderStatus, onPaid })
        ├── FCM layer: useNotificationStore selector (tất cả method)
        ├── Polling layer: exponential backoff setInterval (BANK_TRANSFER only)
        └── Optimistic layer: immediate flag (POINT only)
```

---

## Hook Interface

```ts
// hooks/use-payment-status-detector.ts

interface UsePaymentStatusDetectorOptions {
  orderSlug: string
  method: PaymentMethod | null
  // null = payment chưa được submit; Date.now() khi executePayment.onSuccess fire
  submittedAt: number | null
  // Current order status từ API response — hook dùng để detect PAID qua polling
  orderStatus: OrderStatus | undefined
  // Called khi polling muốn trigger refetch ở parent
  onPaid: () => void
}

interface UsePaymentStatusDetectorResult {
  showSuccess: boolean
}

export function usePaymentStatusDetector(
  options: UsePaymentStatusDetectorOptions,
): UsePaymentStatusDetectorResult
```

### `showSuccess` logic

```
showSuccess =
  fcmDetected           // ORDER_PAID notification match orderSlug
  || optimisticPaid     // POINT: submittedAt !== null
  || orderStatus === OrderStatus.PAID  // polling detected via refetch
```

---

## Strategy: BANK_TRANSFER

### FCM Path (happy path — ~0ms lag)

1. Subscribe `useNotificationStore` selector: tìm notification `unread + ORDER_PAID + metadata.order === orderSlug`
2. Khi match: set internal `fcmDetected = true`, gọi `onPaid()` (để component refetch + sync order state), cancel polling interval

### Polling Path (fallback — khi FCM fail)

Exponential backoff intervals: `[10, 15, 20, 30]` giây (cap tại 30s).

```
Tick 1: delay 10s → onPaid() [refetchOrder]
Tick 2: delay 15s → onPaid()
Tick 3: delay 20s → onPaid()
Tick 4+: delay 30s → onPaid()  (mỗi tick tiếp theo)
```

- Start: `submittedAt !== null && method === BANK_TRANSFER && !showSuccess`
- Stop: khi `showSuccess === true` (FCM hoặc `orderStatus === PAID`)
- Cancel: khi `fcmDetected` bật trước polling tick tiếp theo

**Kết quả:** Happy path (FCM) = 1 refetch. FCM fail = 4 calls trong ~75s đầu, sau đó 1 call/30s thay vì 1 call/10s.

### State trong hook

```ts
const fcmDetected = useRef(false)
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
const tickIndexRef = useRef(0)
const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
```

`fcmDetected` dùng `useRef` (không cần re-render — `showSuccess` đã được tính từ notification store selector). `forceUpdate` chỉ cần thiết nếu muốn re-evaluate `showSuccess` ngay sau FCM.

Thực tế: `useNotificationStore` selector tự trigger re-render khi notification arrive → không cần `forceUpdate`.

---

## Strategy: POINT

### Optimistic Path (instant — 0ms)

- `submittedAt !== null && method === POINT` → `optimisticPaid = true` ngay lập tức
- Không cần polling
- `onPaid()` được gọi 1 lần sau khi `submittedAt` set → silent background sync

### Rollback

Không cần. POINT payment là synchronous: API trả 200 = server đã xác nhận thanh toán. Nếu API fail → `onError` fire → `setSubmittedAt(null)` không bao giờ xảy ra → `optimisticPaid` vẫn `false`.

---

## Component Changes (`app/payment/[order].tsx`)

### Xóa

```ts
// Xóa: lines 459–467 (hasOrderPaidNotification + showSuccess)
const hasOrderPaidNotification = useNotificationStore(...)
const showSuccess = hasOrderPaidNotification || order?.status === OrderStatus.PAID

// Xóa: lines 483–495 (processedRef + FCM useEffect)
const processedRef = useRef<Set<string>>(new Set())
const latestNotification = useNotificationStore(...)
useEffect(() => { ... }, [latestNotification, orderSlug, refetchOrder])

// Xóa: lines 613–617 (polling useEffect)
useEffect(() => {
  if (!qrCode || showSuccess) return
  const id = setInterval(() => void refetchOrderRef.current(), 10_000)
  return () => clearInterval(id)
}, [qrCode, showSuccess])
```

### Thêm

```ts
// Thêm: state để signal hook khi payment submitted
const [paymentSubmittedAt, setPaymentSubmittedAt] = useState<number | null>(null)

// Thêm: trong executePayment.onSuccess, sau dispatchPaymentForm
setPaymentSubmittedAt(Date.now())

// Thêm: hook call (thay thế showSuccess cũ)
const { showSuccess } = usePaymentStatusDetector({
  orderSlug: orderSlug ?? '',
  method: selectedPaymentMethod,
  submittedAt: paymentSubmittedAt,
  orderStatus: order?.status,
  onPaid: refetchOrder,
})
```

`refetchOrderRef` (lines 608–611) vẫn giữ lại trong component vì vẫn cần cho các `useFocusEffect` khác.

---

## Edge Cases

| Case | Handling |
|---|---|
| FCM arrive trước khi user submit (stale notification) | `submittedAt === null` → hook disabled → `fcmDetected` không bật. Chỉ `orderStatus === PAID` mới set `showSuccess` |
| User navigate away rồi quay lại khi order đã PAID | `useFocusEffect` → `refetchOrder` → `orderStatus === PAID` → `showSuccess = true` |
| `onPaid()` gọi nhiều lần rapid (polling + FCM cùng lúc) | React Query deduplicates inflight requests — safe |
| `submittedAt` thay đổi khi resend (BANK_TRANSFER QR refresh) | Polling reset: `useEffect` deps `[submittedAt]` → interval recreated, `tickIndexRef` reset về 0 |
| Network offline trong polling | `onPaid()` → `refetchOrder` fail silently → TanStack Query retry tự handle |

---

## Testing Plan

File: `__tests__/hooks/use-payment-status-detector.test.ts`

### Test cases

**BANK_TRANSFER:**
- `showSuccess = false` khi `submittedAt = null`
- `showSuccess = true` ngay khi `orderStatus = PAID` (không cần notification)
- FCM notification match → `showSuccess = true` + `onPaid` called 1 lần
- FCM notification với orderSlug khác → `showSuccess = false`
- Polling fires sau 10s (jest fake timers) → `onPaid` called
- Polling fires sau 10s, 25s, 45s (accumulative) → `tickIndexRef` tăng đúng
- Polling cancel khi `showSuccess = true`

**POINT:**
- `showSuccess = true` ngay khi `submittedAt !== null`
- `onPaid` called 1 lần sau khi `submittedAt` set
- `showSuccess = false` khi `submittedAt = null`

**Shared:**
- `orderStatus === PAID` luôn set `showSuccess = true` bất kể method

---

## Out of Scope

- CASH, CREDIT_CARD payment methods (không có trong app khách)
- WebSocket / SSE (yêu cầu backend changes)
- QR code expiry riêng biệt (separate feature)
- Push notification permission flow

---

## Acceptance Criteria

1. `PaymentPageContent` không còn chứa FCM selector, polling `useEffect`, hay `processedRef`
2. BANK_TRANSFER: đo được < 10 `refetchOrder` calls trong 15 phút khi FCM hoạt động bình thường
3. POINT: `showSuccess` bật trong cùng render cycle với `setPaymentSubmittedAt`
4. `npm run check` pass sau khi implement
5. Tất cả test cases trong plan pass
