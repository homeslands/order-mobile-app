# Memory Leak Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all confirmed memory leaks found in the Opus 4.7 audit — 2 MEDIUM leaks and 4 LOW copy-timer sites.

**Architecture:** Each fix is surgical: add a cleanup `useEffect` to the affected component or guard existing state-setting callbacks with an already-present `isStopped` flag. No refactoring, no new abstractions — mirror patterns that already exist correctly elsewhere in the same codebase.

**Tech Stack:** React Native, React `useRef` / `useEffect`, TypeScript

---

## Files to modify

| File                                                          | Change                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `app/update-order/components/update-order-content-native.tsx` | Add cleanup useEffect for `qtyDebounceRef` + `noteDebounceRef` (M1)              |
| `hooks/use-qr-payment.ts`                                     | Guard `setFetchState` / `setCountdown` with `r.isStopped` after async fetch (M2) |
| `app/profile/loyalty-point-detail-dialog.tsx`                 | Refactor copy `setTimeout` to tracked ref + cleanup (L1)                         |
| `app/profile/gift-cards.tsx`                                  | Refactor copy `setTimeout` to tracked ref + cleanup (L1)                         |
| `components/gift-card/gift-card-order-detail-sheet.tsx`       | Refactor copy `setTimeout` to tracked ref + cleanup (L1)                         |
| `components/gift-card/gift-card-detail-sheet.tsx`             | Refactor copy `setTimeout` to tracked ref + cleanup (L1)                         |

---

### Task 1: Fix debounce timer leak in update-order row (M1)

**Files:**

- Modify: `app/update-order/components/update-order-content-native.tsx:148`

**Context:** The `OrderItemRow` component inside this file has `qtyDebounceRef` and `noteDebounceRef` for optimistic qty/note updates. When the row unmounts (FlashList recycling, navigation, draft cancel), both timers keep running and call `onQtyChange`/`onNoteChange` after unmount, causing a stale store mutation. The correct pattern already exists in `components/cart/cart-item-row.tsx:138–151` — mirror it exactly.

- [ ] **Step 1: Open the file and locate the insertion point**

Open `app/update-order/components/update-order-content-native.tsx`. Find line 148 — the end of `handleNoteChange` callback (right after the closing `},` of the `useCallback`). The cleanup `useEffect` goes immediately after this block, before the price calculation comment.

- [ ] **Step 2: Add the cleanup useEffect**

Insert the following block at line 149 (after `handleNoteChange` closes, before `// ── Price calculation`):

```tsx
// Cleanup pending timers on unmount — both qty debounce and note debounce
// could fire after the row is unmounted (FlashList recycling or cancel).
useEffect(() => {
  return () => {
    if (qtyDebounceRef.current) {
      clearTimeout(qtyDebounceRef.current)
      qtyDebounceRef.current = null
    }
    if (noteDebounceRef.current) {
      clearTimeout(noteDebounceRef.current)
      noteDebounceRef.current = null
    }
  }
}, [])
```

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/update-order/components/update-order-content-native.tsx
git commit -m "fix(update-order): clear debounce timers on OrderItemRow unmount"
```

---

### Task 2: Guard post-unmount setState in useQRPayment (M2)

**Files:**

- Modify: `hooks/use-qr-payment.ts:85–104`

**Context:** `fetchQR` is async. `stopTimers()` sets `refs.current.isStopped = true` on unmount. But after `generatePaymentQR()` resolves, `setFetchState(...)` and `setCountdown(QR_TTL_S)` are called unconditionally — even if `isStopped` is already `true`. The fix is to add `if (r.isStopped) return` guards in both the happy path and the catch block, mirroring the existing guard at `if (!r.isStopped) startCountdown()`.

- [ ] **Step 1: Add isStopped guard after successful fetch resolves**

In `hooks/use-qr-payment.ts`, find the `try` block inside `fetchQR` (around line 85). Replace this section:

```ts
// BEFORE
try {
  const res = await generatePaymentQR()
  const data: IQRGenerateResponse = res.result
  r.expiresAtMs = new Date(data.expiresAt).getTime()
  setFetchState({
    token: data.token,
    error: null,
    isLoading: false,
    isRefreshing: false,
  })
  setCountdown(QR_TTL_S)
  // Guard: skip if stopTimers() was called while fetch was in-flight
  if (!r.isStopped) startCountdown()
} catch {
  setFetchState((s) => ({
    ...s,
    error: 'Không thể tạo mã QR. Vui lòng thử lại.',
    isLoading: false,
    isRefreshing: false,
  }))
}
```

With:

```ts
// AFTER
try {
  const res = await generatePaymentQR()
  if (r.isStopped) return
  const data: IQRGenerateResponse = res.result
  r.expiresAtMs = new Date(data.expiresAt).getTime()
  setFetchState({
    token: data.token,
    error: null,
    isLoading: false,
    isRefreshing: false,
  })
  setCountdown(QR_TTL_S)
  if (!r.isStopped) startCountdown()
} catch {
  if (r.isStopped) return
  setFetchState((s) => ({
    ...s,
    error: 'Không thể tạo mã QR. Vui lòng thử lại.',
    isLoading: false,
    isRefreshing: false,
  }))
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-qr-payment.ts
git commit -m "fix(payment): guard post-unmount setState in useQRPayment.fetchQR"
```

---

### Task 3: Fix copy-to-clipboard timer leaks (L1) — 4 sites

**Files:**

- Modify: `app/profile/loyalty-point-detail-dialog.tsx:125–130`
- Modify: `app/profile/gift-cards.tsx:292–296`
- Modify: `components/gift-card/gift-card-order-detail-sheet.tsx:82–87`
- Modify: `components/gift-card/gift-card-detail-sheet.tsx:51–61`

**Context:** All 4 sites use `setTimeout(() => setCopied(false), 1500)` with no ref and no cleanup. If the component unmounts within 1.5s, the timer fires on an unmounted component. The correct pattern is at `app/profile/coin-transaction-detail-sheet.tsx:88–102` — use a `copyTimerRef`, clear before setting new timer, and cleanup on unmount.

- [ ] **Step 1: Fix `loyalty-point-detail-dialog.tsx`**

Find the `CopyRow` function component (around line 118). Replace:

```tsx
// BEFORE
const [copied, setCopied] = useState(false)
const handleCopy = useCallback(() => {
  Clipboard.setString(value)
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}, [value])
```

With:

```tsx
// AFTER
const [copied, setCopied] = useState(false)
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const handleCopy = useCallback(() => {
  Clipboard.setString(value)
  setCopied(true)
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  copyTimerRef.current = setTimeout(() => {
    setCopied(false)
    copyTimerRef.current = null
  }, 1500)
}, [value])
useEffect(() => {
  return () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  }
}, [])
```

Ensure `useRef` and `useEffect` are in the import list at the top of the file (they may already be there — check before adding).

- [ ] **Step 2: Fix `gift-cards.tsx`**

Find the `GiftCardItem` component's `handleCopyCode` callback (around line 292). Replace:

```tsx
// BEFORE
const handleCopyCode = useCallback(() => {
  Clipboard.setString(item.code)
  setCodeCopied(true)
  setTimeout(() => setCodeCopied(false), 1500)
}, [item.code])
```

With:

```tsx
// AFTER
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const handleCopyCode = useCallback(() => {
  Clipboard.setString(item.code)
  setCodeCopied(true)
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  copyTimerRef.current = setTimeout(() => {
    setCodeCopied(false)
    copyTimerRef.current = null
  }, 1500)
}, [item.code])
useEffect(() => {
  return () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  }
}, [])
```

Place `copyTimerRef` declaration immediately before `handleCopyCode`. Place `useEffect` immediately after `handleCopyCode`.

Ensure `useRef` and `useEffect` are in the import list.

- [ ] **Step 3: Fix `gift-card-order-detail-sheet.tsx`**

Find the `CopyRow` function (around line 77). Replace:

```tsx
// BEFORE
const [copied, setCopied] = useState(false)
const handleCopy = useCallback(() => {
  Clipboard.setString(value)
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}, [value])
```

With:

```tsx
// AFTER
const [copied, setCopied] = useState(false)
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const handleCopy = useCallback(() => {
  Clipboard.setString(value)
  setCopied(true)
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  copyTimerRef.current = setTimeout(() => {
    setCopied(false)
    copyTimerRef.current = null
  }, 1500)
}, [value])
useEffect(() => {
  return () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  }
}, [])
```

Ensure `useRef` and `useEffect` are imported.

- [ ] **Step 4: Fix `gift-card-detail-sheet.tsx`**

Find the `CopyRow` function (around line 40). Replace:

```tsx
// BEFORE
const [copied, setCopied] = useState(false)
// ... (color vars) ...
const handleCopy = useCallback(() => {
  Clipboard.setString(value)
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}, [value])
```

With:

```tsx
// AFTER
const [copied, setCopied] = useState(false)
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
// ... (color vars unchanged) ...
const handleCopy = useCallback(() => {
  Clipboard.setString(value)
  setCopied(true)
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  copyTimerRef.current = setTimeout(() => {
    setCopied(false)
    copyTimerRef.current = null
  }, 1500)
}, [value])
useEffect(() => {
  return () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  }
}, [])
```

`useRef` and `useEffect` are already imported (line 13 shows `memo, useCallback, useEffect, useMemo, useRef, useState`).

- [ ] **Step 5: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/profile/loyalty-point-detail-dialog.tsx \
        app/profile/gift-cards.tsx \
        components/gift-card/gift-card-order-detail-sheet.tsx \
        components/gift-card/gift-card-detail-sheet.tsx
git commit -m "fix(ui): track copy-to-clipboard timers with refs to prevent post-unmount setState"
```
