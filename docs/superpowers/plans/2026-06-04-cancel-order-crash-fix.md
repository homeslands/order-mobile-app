# Cancel Order Crash Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs in the order cancellation flow: silent API failure, crash from double-dismiss during mutation, stale data after back-navigation, and invalid `dismiss()` on mount.

**Architecture:** All fixes are confined to `cancel-order-dialog.tsx` and two i18n files. No new files, no new abstractions — surgical edits only.

**Tech Stack:** React Native, `@gorhom/bottom-sheet`, TanStack Query `useMutation`, i18n (`react-i18next`), `showToast` from `@/utils/toast`.

---

## Background — 4 Bugs Being Fixed

| # | Bug | Symptom |
|---|-----|---------|
| 1 | No `onError` handler | API fail → spinner stops → nothing; user doesn't know what happened |
| 2 | Sheet dismissible during mutation | Swipe/backdrop tap while loading → `onDismiss` + `useEffect` both call `dismiss()` → `@gorhom` internal state machine crash |
| 3 | `invalidateQueries` inside 500ms timer | Back-nav during timer → cleanup clears timer → order list never refreshes |
| 4 | `dismiss()` called on mount | `useEffect([visible])` runs with `visible=false` on first render → calls `dismiss()` before any `present()` |

---

## Files

- **Modify:** `components/dialog/cancel-order-dialog.tsx` — all 4 fixes
- **Modify:** `i18n/vi/toast.json` — add `handleCancelOrderError` key
- **Modify:** `i18n/en/toast.json` — add `handleCancelOrderError` key

---

## Task 1: Add i18n error keys

**Files:**
- Modify: `i18n/vi/toast.json:146`
- Modify: `i18n/en/toast.json:146`

- [ ] **Step 1: Add Vietnamese error key**

In `i18n/vi/toast.json`, after line 146 (`"handleCancelOrderSuccess": "Hủy đơn hàng thành công"`), add:

```json
    "handleCancelOrderSuccess": "Hủy đơn hàng thành công",
    "handleCancelOrderError": "Hủy đơn hàng thất bại, vui lòng thử lại",
```

- [ ] **Step 2: Add English error key**

In `i18n/en/toast.json`, after line 146 (`"handleCancelOrderSuccess": "Order canceled successfully"`), add:

```json
    "handleCancelOrderSuccess": "Order canceled successfully",
    "handleCancelOrderError": "Failed to cancel order, please try again",
```

- [ ] **Step 3: Verify no JSON syntax error**

```bash
node -e "require('./i18n/vi/toast.json'); require('./i18n/en/toast.json'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 4: Commit**

```bash
git add i18n/vi/toast.json i18n/en/toast.json
git commit -m "fix(order): add i18n error key for cancel order failure"
```

---

## Task 2: Fix all 4 bugs in cancel-order-dialog.tsx

**Files:**
- Modify: `components/dialog/cancel-order-dialog.tsx`

All changes are in this file. Apply them in order.

### Fix 4 — Guard `dismiss()` on mount

**Problem (line 58-64):** `useEffect([visible])` runs immediately on mount with `visible=false` and calls `sheetRef.current?.dismiss()` before the modal has ever been presented.

- [ ] **Step 1: Add `hasPresentedRef` after `sheetRef`**

Current code at line 46-47:
```ts
const sheetRef = useRef<BottomSheetModal>(null)
const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

Replace with:
```ts
const sheetRef = useRef<BottomSheetModal>(null)
const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const hasPresentedRef = useRef(false)
```

- [ ] **Step 2: Guard the `dismiss()` call in the visibility effect**

Current code at line 58-64:
```ts
useEffect(() => {
  if (visible) {
    sheetRef.current?.present()
  } else {
    sheetRef.current?.dismiss()
  }
}, [visible])
```

Replace with:
```ts
useEffect(() => {
  if (visible) {
    hasPresentedRef.current = true
    sheetRef.current?.present()
  } else if (hasPresentedRef.current) {
    sheetRef.current?.dismiss()
  }
}, [visible])
```

### Fix 2 — Lock sheet during mutation

**Problem (line 87-98, 125):** `pressBehavior="close"` and `enablePanDownToClose` remain active while `isDeleting=true`, allowing the sheet to be dismissed via swipe or backdrop tap during the API call. This triggers `onDismiss` → `handleClose` → `setVisible(false)` → `useEffect` → second `dismiss()` call on an already-animating sheet.

- [ ] **Step 3: Make backdrop `pressBehavior` reactive to `isDeleting`**

Current code at line 87-98:
```ts
const renderBackdrop = useCallback(
  (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior="close"
    />
  ),
  [],
)
```

Replace with:
```ts
const renderBackdrop = useCallback(
  (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior={isDeleting ? 'none' : 'close'}
    />
  ),
  [isDeleting],
)
```

- [ ] **Step 4: Disable pan-to-close during mutation**

Current code at line 125:
```tsx
enablePanDownToClose
```

Replace with:
```tsx
enablePanDownToClose={!isDeleting}
```

### Fix 3 — Move `invalidateQueries` out of the timer

**Problem (line 69-79):** `queryClient.invalidateQueries` is inside a 500ms `setTimeout`. If the user presses back within those 500ms, component unmount clears the timer via the cleanup `useEffect`, so `invalidateQueries` never fires and the order list shows stale data.

Fix: call `invalidateQueries` immediately in `onSuccess`, before the timer. The timer now only handles UI: showing the toast and closing the dialog.

### Fix 1 — Add `onError` handler

**Problem:** `deleteOrder` mutation has no `onError` — API failure is silently swallowed.

- [ ] **Step 5: Rewrite `handleConfirm` with both fixes (Fix 3 + Fix 1)**

Current code at line 66-80:
```ts
const handleConfirm = useCallback(() => {
  if (!order?.slug || isDeleting) return
  deleteOrder(order.slug, {
    onSuccess: () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['order', order.slug] })
        showToast(tToast('toast.handleCancelOrderSuccess'))
        setVisible(false)
        successTimerRef.current = null
      }, 500)
    },
  })
}, [order, isDeleting, deleteOrder, queryClient, tToast])
```

Replace with:
```ts
const handleConfirm = useCallback(() => {
  if (!order?.slug || isDeleting) return
  deleteOrder(order.slug, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', order.slug] })
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => {
        showToast(tToast('toast.handleCancelOrderSuccess'))
        setVisible(false)
        successTimerRef.current = null
      }, 500)
    },
    onError: () => {
      showToast(tToast('toast.handleCancelOrderError'), 'error')
    },
  })
}, [order, isDeleting, deleteOrder, queryClient, tToast])
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0, no errors.

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: exit 0, no errors.

- [ ] **Step 8: Commit**

```bash
git add components/dialog/cancel-order-dialog.tsx
git commit -m "fix(order): fix crash and silent failure in cancel order dialog

- Guard dismiss() on mount to prevent invalid bottom-sheet state
- Lock sheet (pan + backdrop) during mutation to prevent double-dismiss crash
- Move invalidateQueries before setTimeout so back-nav doesn't lose cache update
- Add onError handler so API failure shows error toast instead of silently failing"
```

---

## Task 3: Manual verification

No automated test infrastructure for component behavior — verify manually on device/simulator.

- [ ] **Step 1: Start dev server**

```bash
expo start
```

- [ ] **Step 2: Verify Fix 1 (onError)**

Simulate API failure by disabling network (Airplane mode or Charles Proxy block).
- Open an order with status PENDING
- Tap "Huỷ đơn" → "Xác nhận huỷ"
- Expected: error toast "Hủy đơn hàng thất bại, vui lòng thử lại" appears; dialog stays open; button re-enables

- [ ] **Step 3: Verify Fix 2 (sheet lock during mutation)**

With network throttled to slow 3G (Charles Proxy or Network Link Conditioner):
- Open PENDING order → tap "Huỷ đơn" → "Xác nhận huỷ"
- While spinner is showing: swipe sheet down
- Expected: sheet does NOT dismiss; stays open until API completes

- [ ] **Step 4: Verify Fix 2 (backdrop tap)**

Same slow network:
- While spinner is showing: tap the backdrop (area above sheet)
- Expected: nothing happens; sheet stays open

- [ ] **Step 5: Verify Fix 3 (back-nav after success)**

With normal network:
- Open PENDING order → tap "Huỷ đơn" → "Xác nhận huỷ"
- Immediately press back after button is tapped (before 500ms timer)
- Navigate to order list
- Expected: order list shows updated status (not PENDING)

- [ ] **Step 6: Verify Fix 4 (no crash on mount)**

- Navigate to order detail for a PENDING order multiple times
- Expected: no red screen, no warnings about bottom-sheet state in console

- [ ] **Step 7: Verify happy path still works**

Normal flow end-to-end:
- Open PENDING order → "Huỷ đơn" → "Xác nhận huỷ"
- Expected: spinner → success toast → dialog closes → order status updates

---

## Final state of `cancel-order-dialog.tsx` (key sections)

For reference, the 4 changed areas after all fixes:

```ts
// 1. New ref (after successTimerRef)
const hasPresentedRef = useRef(false)

// 2. Guarded visibility effect
useEffect(() => {
  if (visible) {
    hasPresentedRef.current = true
    sheetRef.current?.present()
  } else if (hasPresentedRef.current) {
    sheetRef.current?.dismiss()
  }
}, [visible])

// 3. handleConfirm with invalidateQueries before timer + onError
const handleConfirm = useCallback(() => {
  if (!order?.slug || isDeleting) return
  deleteOrder(order.slug, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', order.slug] })
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => {
        showToast(tToast('toast.handleCancelOrderSuccess'))
        setVisible(false)
        successTimerRef.current = null
      }, 500)
    },
    onError: () => {
      showToast(tToast('toast.handleCancelOrderError'), 'error')
    },
  })
}, [order, isDeleting, deleteOrder, queryClient, tToast])

// 4. Backdrop locked during mutation
const renderBackdrop = useCallback(
  (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior={isDeleting ? 'none' : 'close'}
    />
  ),
  [isDeleting],
)

// 5. In JSX — pan lock
<BottomSheetModal
  enablePanDownToClose={!isDeleting}
  ...
>
```
