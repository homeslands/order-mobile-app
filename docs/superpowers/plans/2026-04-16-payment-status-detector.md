# Payment Status Detector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract FCM + exponential-backoff polling + optimistic success-detection out of `PaymentPageContent` into a dedicated `usePaymentStatusDetector` hook, eliminating ~45 lines of inline logic and reducing BANK_TRANSFER polling from 90 calls/session to ~4 calls in the first 75 seconds.

**Architecture:** Single hook owns three detection layers — (1) Zustand notification-store selector for FCM, (2) recursive `setTimeout` exponential backoff for BANK_TRANSFER polling, (3) optimistic flag for POINT. Component signals payment submission via a `submittedAt: number | null` timestamp and receives a `showSuccess: boolean` back.

**Tech Stack:** React hooks, Zustand (`useNotificationStore`), `setTimeout` (no external libs), `@testing-library/react-native` `renderHook` + `jest.useFakeTimers`.

**Spec:** `docs/superpowers/specs/2026-04-16-payment-status-detector-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `hooks/use-payment-status-detector.ts` | **Create** | FCM / polling / optimistic logic |
| `__tests__/hooks/use-payment-status-detector.test.ts` | **Create** | Unit tests |
| `hooks/index.ts` | **Modify** | Export new hook (1 line) |
| `app/payment/[order].tsx` | **Modify** | Remove inline detection, use hook |

---

### Task 1: Write failing tests

**Files:**
- Create: `__tests__/hooks/use-payment-status-detector.test.ts`

- [ ] **Step 1: Create the test file**

```tsx
import { act, renderHook } from '@testing-library/react-native'

import { NotificationMessageCode, PaymentMethod } from '@/constants'
import { usePaymentStatusDetector } from '@/hooks/use-payment-status-detector'
import { OrderStatus } from '@/types'

// ── Mock ──────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseNotificationStore = jest.fn<unknown, [((s: any) => unknown)]>()

jest.mock('@/stores', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  useNotificationStore: (sel: (s: unknown) => unknown) => mockUseNotificationStore(sel),
}))

type FakeNotification = {
  slug: string
  isRead: boolean
  message: string
  metadata?: { order?: string }
}

function setNotifications(notifications: FakeNotification[]) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  mockUseNotificationStore.mockImplementation((sel) => sel({ notifications }))
}

// ── Shared defaults ───────────────────────────────────────────────────────────
const base = {
  orderSlug: 'order-1',
  orderStatus: OrderStatus.PENDING as OrderStatus | undefined,
  onPaid: jest.fn(),
}

beforeEach(() => {
  setNotifications([])
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

// ── Shared: orderStatus PAID always wins ──────────────────────────────────────
it('showSuccess = false when submittedAt = null and order PENDING', () => {
  const { result } = renderHook(() =>
    usePaymentStatusDetector({
      ...base,
      method: PaymentMethod.BANK_TRANSFER,
      submittedAt: null,
    }),
  )
  expect(result.current.showSuccess).toBe(false)
})

it('showSuccess = true when orderStatus = PAID regardless of method', () => {
  const { result } = renderHook(() =>
    usePaymentStatusDetector({
      ...base,
      method: PaymentMethod.BANK_TRANSFER,
      submittedAt: null,
      orderStatus: OrderStatus.PAID,
    }),
  )
  expect(result.current.showSuccess).toBe(true)
})

// ── POINT ─────────────────────────────────────────────────────────────────────
describe('POINT', () => {
  it('showSuccess = true immediately when submittedAt is set', () => {
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(true)
  })

  it('showSuccess = false when submittedAt = null', () => {
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: null,
      }),
    )
    expect(result.current.showSuccess).toBe(false)
  })

  it('calls onPaid once for silent background sync', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('does not start polling (no extra onPaid calls after sync)', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    act(() => { jest.advanceTimersByTime(60_000) })
    // Exactly 1 call: silent sync only, no polling ticks
    expect(onPaid).toHaveBeenCalledTimes(1)
  })
})

// ── BANK_TRANSFER ─────────────────────────────────────────────────────────────
describe('BANK_TRANSFER', () => {
  it('showSuccess = true when matching ORDER_PAID notification exists', () => {
    setNotifications([{
      slug: 'n1', isRead: false,
      message: NotificationMessageCode.ORDER_PAID,
      metadata: { order: 'order-1' },
    }])
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(true)
  })

  it('showSuccess = false when notification targets a different order', () => {
    setNotifications([{
      slug: 'n1', isRead: false,
      message: NotificationMessageCode.ORDER_PAID,
      metadata: { order: 'other-order' },
    }])
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(false)
  })

  it('showSuccess = false when notification is already read', () => {
    setNotifications([{
      slug: 'n1', isRead: true,
      message: NotificationMessageCode.ORDER_PAID,
      metadata: { order: 'order-1' },
    }])
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(false)
  })

  it('polling does not start when submittedAt = null', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: null,
        onPaid,
      }),
    )
    act(() => { jest.advanceTimersByTime(60_000) })
    expect(onPaid).not.toHaveBeenCalled()
  })

  it('polling fires onPaid after 10s (first tick)', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    expect(onPaid).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(10_000) })
    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('polling uses exponential backoff: 10s then 15s', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    act(() => { jest.advanceTimersByTime(10_000) })
    expect(onPaid).toHaveBeenCalledTimes(1)
    act(() => { jest.advanceTimersByTime(14_999) })
    expect(onPaid).toHaveBeenCalledTimes(1) // 15s not reached yet
    act(() => { jest.advanceTimersByTime(1) })
    expect(onPaid).toHaveBeenCalledTimes(2) // 15s tick fires
  })

  it('polling caps at 30s after 4th tick onward', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    act(() => { jest.advanceTimersByTime(10_000) }) // tick 1 (+10s)
    act(() => { jest.advanceTimersByTime(15_000) }) // tick 2 (+15s)
    act(() => { jest.advanceTimersByTime(20_000) }) // tick 3 (+20s)
    expect(onPaid).toHaveBeenCalledTimes(3)
    act(() => { jest.advanceTimersByTime(30_000) }) // tick 4 (capped at 30s)
    expect(onPaid).toHaveBeenCalledTimes(4)
    act(() => { jest.advanceTimersByTime(30_000) }) // tick 5 (still 30s)
    expect(onPaid).toHaveBeenCalledTimes(5)
  })
})
```

- [ ] **Step 2: Run — verify all tests FAIL with "Cannot find module"**

```bash
npx jest __tests__/hooks/use-payment-status-detector.test.ts --no-coverage
```

Expected output: All tests **FAIL** — `Cannot find module '@/hooks/use-payment-status-detector'`

---

### Task 2: Implement `usePaymentStatusDetector`

**Files:**
- Create: `hooks/use-payment-status-detector.ts`

- [ ] **Step 1: Create the hook file**

```ts
import { useEffect, useRef } from 'react'

import { NotificationMessageCode, PaymentMethod } from '@/constants'
import { useNotificationStore } from '@/stores'
import { OrderStatus } from '@/types'

// Notification codes that indicate a customer order was paid.
// Mirrors the constant in app/payment/[order].tsx — both must stay in sync if codes change.
const PAID_NOTIFICATION_CODES: ReadonlySet<NotificationMessageCode> = new Set([
  NotificationMessageCode.ORDER_PAID,
  NotificationMessageCode.CARD_ORDER_PAID,
])

// Exponential backoff delays for BANK_TRANSFER polling (milliseconds).
// Index maps to tick number; last entry is the permanent cap.
const POLL_INTERVALS_MS = [10_000, 15_000, 20_000, 30_000] as const

export interface UsePaymentStatusDetectorOptions {
  /** Slug of the order being paid. */
  orderSlug: string
  /** Currently submitted payment method. null = payment not yet submitted. */
  method: PaymentMethod | null
  /**
   * Set to Date.now() when executePayment.onSuccess fires; null otherwise.
   * Changing this value resets the BANK_TRANSFER polling interval to tick 0.
   */
  submittedAt: number | null
  /** Latest order.status from the API — detects PAID after a poll refetch. */
  orderStatus: OrderStatus | undefined
  /**
   * Called when the hook wants the parent to refetch order data.
   * BANK_TRANSFER: called on each poll tick and when FCM arrives.
   * POINT: called once for silent background sync after optimistic success.
   */
  onPaid: () => void
}

export function usePaymentStatusDetector({
  orderSlug,
  method,
  submittedAt,
  orderStatus,
  onPaid,
}: UsePaymentStatusDetectorOptions): { showSuccess: boolean } {
  // Stable ref so effects always call the latest onPaid without re-subscribing.
  const onPaidRef = useRef(onPaid)
  useEffect(() => {
    onPaidRef.current = onPaid
  }, [onPaid])

  // ── FCM detection ─────────────────────────────────────────────────────────
  // Returns a boolean — Zustand skips re-render when the value hasn't changed.
  const fcmDetected = useNotificationStore((s) =>
    s.notifications.some(
      (n) =>
        !n.isRead &&
        PAID_NOTIFICATION_CODES.has(n.message as NotificationMessageCode) &&
        n.metadata?.order === orderSlug,
    ),
  )

  // ── showSuccess derivation ────────────────────────────────────────────────
  // POINT: API 200 = server confirmed → optimistic success, no rollback needed.
  const optimisticPaid = method === PaymentMethod.POINT && submittedAt !== null
  const showSuccess =
    fcmDetected || optimisticPaid || orderStatus === OrderStatus.PAID

  // Latest showSuccess in a ref so setTimeout callbacks avoid stale closures.
  const showSuccessRef = useRef(showSuccess)
  useEffect(() => {
    showSuccessRef.current = showSuccess
  }, [showSuccess])

  // ── BANK_TRANSFER: exponential backoff polling ─────────────────────────────
  // Starts when submittedAt is set and payment not yet detected.
  // Cleanup (effect teardown) cancels the pending timeout when showSuccess
  // becomes true — prevents a stale tick firing after success.
  useEffect(() => {
    if (method !== PaymentMethod.BANK_TRANSFER || submittedAt === null || showSuccess) return

    let tickIndex = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (showSuccessRef.current) return
      const delay =
        POLL_INTERVALS_MS[Math.min(tickIndex, POLL_INTERVALS_MS.length - 1)]
      timeoutId = setTimeout(() => {
        if (showSuccessRef.current) return
        onPaidRef.current()
        tickIndex += 1
        schedule()
      }, delay)
    }

    schedule()

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [method, submittedAt, showSuccess])

  // ── BANK_TRANSFER: sync order state when FCM arrives ─────────────────────
  // fcmDetected=true already sets showSuccess, but the parent still needs a
  // refetch so invoice/receipt fields are populated in the success screen.
  const prevFcmRef = useRef(false)
  useEffect(() => {
    if (!prevFcmRef.current && fcmDetected && method === PaymentMethod.BANK_TRANSFER) {
      onPaidRef.current()
    }
    prevFcmRef.current = fcmDetected
  }, [fcmDetected, method])

  // ── POINT: silent background sync ─────────────────────────────────────────
  // Optimistic flag shows success instantly; one refetch syncs order.status
  // in the parent's React Query cache so order detail shows PAID correctly.
  useEffect(() => {
    if (method !== PaymentMethod.POINT || submittedAt === null) return
    onPaidRef.current()
  }, [method, submittedAt])

  return { showSuccess }
}
```

- [ ] **Step 2: Run tests — verify all pass**

```bash
npx jest __tests__/hooks/use-payment-status-detector.test.ts --no-coverage
```

Expected: All **PASS** (`15 passing` or similar)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-payment-status-detector.ts __tests__/hooks/use-payment-status-detector.test.ts
git commit -m "feat(payment): add usePaymentStatusDetector hook with tests

Exponential backoff polling (10→15→20→30s) for BANK_TRANSFER + optimistic
showSuccess for POINT. All 15 tests green."
```

---

### Task 3: Export from `hooks/index.ts`

**Files:**
- Modify: `hooks/index.ts`

- [ ] **Step 1: Add export at end of `hooks/index.ts`**

Current last line of `hooks/index.ts` (line 55):
```ts
export * from './use-shake-animation'
```

Append after it:
```ts
export * from './use-payment-status-detector'
```

- [ ] **Step 2: Verify export resolves**

```bash
npm run typecheck 2>&1 | grep "payment-status"
```

Expected: no output (zero type errors from this file)

---

### Task 4: Integrate hook into `PaymentPageContent`

**Files:**
- Modify: `app/payment/[order].tsx`

Context before starting: the four blocks being changed are at these approximate lines in the **current** file —

| Block | Lines | Action |
|---|---|---|
| `hasOrderPaidNotification` + `showSuccess` | 459–467 | Delete both lines |
| FCM `useEffect` + `processedRef` + `latestNotification` | 483–495 | Delete entire block |
| `refetchOrderRef` + polling `useEffect` | 608–617 | Delete entire block |
| `executePayment` `onSuccess` callback | ~697–701 | Insert `setPaymentSubmittedAt` |

- [ ] **Step 1: Delete `hasOrderPaidNotification` and `showSuccess` lines (459–467)**

Find:
```ts
  const hasOrderPaidNotification = useNotificationStore((s) =>
    s.notifications.some(
      (n) =>
        !n.isRead &&
        PAID_NOTIFICATION_CODES.has(n.message as NotificationMessageCode) &&
        n.metadata?.order === orderSlug,
    ),
  )
  const showSuccess = hasOrderPaidNotification || order?.status === OrderStatus.PAID
```

Delete these 9 lines entirely. (`markNotificationRead` on the next line stays — it's still used in `handleViewDetail`.)

- [ ] **Step 2: Delete FCM `useEffect` block (483–495)**

Find:
```ts
  const processedRef = useRef<Set<string>>(new Set())
  const latestNotification = useNotificationStore((s) => s.notifications[0])
  useEffect(() => {
    if (!latestNotification || latestNotification.isRead) return
    if (processedRef.current.has(latestNotification.slug)) return
    if (
      PAID_NOTIFICATION_CODES.has(latestNotification.message as NotificationMessageCode) &&
      latestNotification.metadata?.order === orderSlug
    ) {
      processedRef.current.add(latestNotification.slug)
      refetchOrder()
    }
  }, [latestNotification, orderSlug, refetchOrder])
```

Delete the entire block.

- [ ] **Step 3: Add `paymentSubmittedAt` state + hook call**

Find (around line 515 after Steps 1–2 shift the file):
```ts
  const [isExpired, setIsExpired] = useState(false)
```

Insert the following block **immediately before** that line:
```ts
  const [paymentSubmittedAt, setPaymentSubmittedAt] = useState<number | null>(null)
```

Then find (around line 600 after deletions):
```ts
  const selectedPaymentMethod = paymentForm.method
  const selectedTransactionId = paymentForm.transactionId
  const qrCode = paymentForm.qrCode

  // Fallback polling when QR is visible
```

Replace the comment + `refetchOrderRef` + polling `useEffect` block (the lines starting with `// Fallback polling` through `}, [qrCode, showSuccess])`) with the hook call:
```ts
  const selectedPaymentMethod = paymentForm.method
  const selectedTransactionId = paymentForm.transactionId
  const qrCode = paymentForm.qrCode

  const { showSuccess } = usePaymentStatusDetector({
    orderSlug: orderSlug ?? '',
    method: selectedPaymentMethod,
    submittedAt: paymentSubmittedAt,
    orderStatus: order?.status,
    onPaid: refetchOrder,
  })
```

- [ ] **Step 4: Add `setPaymentSubmittedAt(Date.now())` in `executePayment.onSuccess`**

Find inside `executePayment` (the `initiatePayment` call's `onSuccess`):
```ts
      onSuccess: (response) => {
        if (response?.result?.qrCode) dispatchPaymentForm({ type: 'SET_QR', qrCode: response.result.qrCode })
        void refetchOrder()
```

Change to:
```ts
      onSuccess: (response) => {
        if (response?.result?.qrCode) dispatchPaymentForm({ type: 'SET_QR', qrCode: response.result.qrCode })
        setPaymentSubmittedAt(Date.now())
        void refetchOrder()
```

- [ ] **Step 5: Add `usePaymentStatusDetector` to the hooks import**

Find:
```ts
import { useInitiatePayment, useInitiatePublicPayment, useOrderBySlug, useRunAfterTransition, useUpdatePublicVoucherInOrder, useUpdateVoucherInOrder } from '@/hooks'
```

Replace with (alphabetical order preserved):
```ts
import { useInitiatePayment, useInitiatePublicPayment, useOrderBySlug, usePaymentStatusDetector, useRunAfterTransition, useUpdatePublicVoucherInOrder, useUpdateVoucherInOrder } from '@/hooks'
```

- [ ] **Step 6: Run `npm run check` — must pass clean**

```bash
npm run check
```

Expected: `0 errors, 0 warnings`

If TypeScript reports `'showSuccess' is not defined` — you missed deleting one of the two `const showSuccess` lines in Step 1. If ESLint reports unused variable for `hasOrderPaidNotification` — same cause.

- [ ] **Step 7: Run all payment-related tests**

```bash
npx jest __tests__/hooks/use-payment-status-detector.test.ts --no-coverage
```

Expected: All **PASS**

- [ ] **Step 8: Commit**

```bash
git add app/payment/[order].tsx hooks/index.ts
git commit -m "refactor(payment): replace inline FCM+polling with usePaymentStatusDetector

Remove processedRef, latestNotification selector, fixed 10s polling interval,
and refetchOrderRef from PaymentPageContent (~45 lines). BANK_TRANSFER now
uses exponential backoff (10→15→20→30s) and cancels on FCM arrive.
POINT shows success screen instantly (optimistic) instead of waiting ~500ms
for refetch to complete.

Closes TCA-3"
```
