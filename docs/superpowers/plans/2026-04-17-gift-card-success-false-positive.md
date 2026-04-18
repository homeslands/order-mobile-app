# Gift Card Success False Positive Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a bug where the payment success screen displays immediately after placing a gift card order, before the user has actually paid.

**Architecture:** The `fcmPaid` Zustand selector in the gift card payment screen has an overly permissive condition — `(!n.metadata?.order || n.metadata.order === slug)` — which matches any unread paid notification that has no `metadata.order` field. An old `ORDER_PAID` (food/drink) notification with no order metadata silently satisfies this, causing `showSuccess` to latch to `true` on mount. The fix is two-line: (1) require an exact slug match in metadata, (2) restrict to `CARD_ORDER_PAID` only since food-order notifications are irrelevant here.

**Tech Stack:** React Native + Expo Router, Zustand (`useNotificationStore`), React Query, TypeScript strict mode.

---

## Background context

### How success detection works (`app/gift-card/checkout/[slug].tsx`)

```
showSuccess = fcmPaid || order?.paymentStatus === CardOrderStatus.COMPLETED

fcmPaid = notificationStore.notifications.some(n =>
  !n.isRead &&
  PAID_NOTIFICATION_CODES.has(n.message) &&   // includes ORDER_PAID + CARD_ORDER_PAID
  (!n.metadata?.order || n.metadata.order === slug)  // ← BUG: matches if no metadata
)
```

`showSuccess` is a latch — once `true` it never reverts:

```tsx
const [showSuccess, setShowSuccess] = useState(false)
useEffect(() => {
  if (
    !showSuccess &&
    (fcmPaid || order?.paymentStatus === CardOrderStatus.COMPLETED)
  ) {
    setShowSuccess(true)
  }
}, [fcmPaid, order?.paymentStatus, showSuccess])
```

### The correct pattern (from `use-payment-status-detector.ts:56-58`)

```tsx
// ✅ food/drink payment — strict slug match
const fcmDetected = useNotificationStore((s) =>
  s.notifications.some(
    (n) =>
      !n.isRead &&
      PAID_NOTIFICATION_CODES.has(n.message) &&
      n.metadata?.order === orderSlug, // no fallback
  ),
)
```

### Why the bug triggers

Scenario A: User paid a food/drink order → `ORDER_PAID` FCM arrives, stored as unread in `notificationStore` with no `metadata.order` field. Later, user opens gift card checkout → payment screen mounts → `!n.metadata?.order` is `true` → `fcmPaid = true` → success screen shown immediately.

Scenario B: User previously completed a gift card order, the `CARD_ORDER_PAID` notification was never marked as read. New gift card order slug is different, but the old notification has no `metadata.order` → same false positive.

---

## Files

| Action | Path                                | What changes                         |
| ------ | ----------------------------------- | ------------------------------------ |
| Modify | `app/gift-card/checkout/[slug].tsx` | Fix `fcmPaid` selector lines 410-416 |

---

## Task 1: Fix the `fcmPaid` selector

**Files:**

- Modify: `app/gift-card/checkout/[slug].tsx:410-416`

- [ ] **Step 1: Locate the buggy selector**

Open `app/gift-card/checkout/[slug].tsx`. Find the `fcmPaid` declaration around line 410:

```tsx
// CURRENT — buggy
const fcmPaid = useNotificationStore((s) =>
  s.notifications.some(
    (n) =>
      !n.isRead &&
      PAID_NOTIFICATION_CODES.has(n.message) &&
      (!n.metadata?.order || n.metadata.order === slug),
  ),
)
```

- [ ] **Step 2: Replace with strict check**

Replace the entire `fcmPaid` declaration with:

```tsx
// FIXED — exact slug match + CARD_ORDER_PAID only
const fcmPaid = useNotificationStore((s) =>
  s.notifications.some(
    (n) =>
      !n.isRead &&
      n.message === NotificationMessageCode.CARD_ORDER_PAID &&
      n.metadata?.order === slug,
  ),
)
```

Two changes:

1. `PAID_NOTIFICATION_CODES.has(n.message)` → `n.message === NotificationMessageCode.CARD_ORDER_PAID` — gift card screen should only react to gift card paid notifications, not food order notifications
2. `(!n.metadata?.order || n.metadata.order === slug)` → `n.metadata?.order === slug` — require exact match, no fallback

`NotificationMessageCode` is already imported at the top of the file via `import { ..., CardOrderStatus, ..., } from '@/constants'` — confirm it is imported, add it to the import if missing.

- [ ] **Step 3: Verify the import**

Check the import line near the top of the file (~line 49-54):

```tsx
import {
  CardOrderPaymentMethod,
  CardOrderStatus,
  colors,
  TAB_ROUTES,
} from '@/constants'
```

`NotificationMessageCode` is not in this import. Add it:

```tsx
import {
  CardOrderPaymentMethod,
  CardOrderStatus,
  colors,
  NotificationMessageCode,
  TAB_ROUTES,
} from '@/constants'
```

- [ ] **Step 4: Remove the now-unused `PAID_NOTIFICATION_CODES` import if it's only used here**

Check line 58:

```tsx
import { PAID_NOTIFICATION_CODES } from '@/hooks'
```

Search the file for any other usage of `PAID_NOTIFICATION_CODES`. If this is the only usage, remove that import line entirely. If it appears elsewhere in the file, leave it.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. If `NotificationMessageCode` import is missing you will see `Cannot find name 'NotificationMessageCode'` — fix per Step 3.

- [ ] **Step 6: Commit**

```bash
git add app/gift-card/checkout/\[slug\].tsx
git commit -m "fix(gift-card): require exact slug match for FCM paid detection

fcmPaid selector used (!n.metadata?.order || ...) which matches any
unread paid notification without order metadata — including old food
order ORDER_PAID notifications. This caused the success screen to show
immediately on mount without actual payment.

Fix: require n.metadata?.order === slug (exact match, no fallback) and
restrict to CARD_ORDER_PAID only since ORDER_PAID is for food orders."
```

---

## Task 2: Manual verification

No automated tests exist for this flow. Verify manually.

**Files:** none (testing only)

- [ ] **Step 1: Reproduce the bug (confirm it existed)**

Before this fix, the trigger was: have an unread food order paid notification in the store. Since that's hard to reproduce in dev, verify by reading the store state in dev mode:

In `app/gift-card/checkout/[slug].tsx`, temporarily add just before the `fcmPaid` declaration:

```tsx
// TEMP DEBUG — remove after testing
const _allNotifs = useNotificationStore((s) => s.notifications)
console.log(
  '[GiftCard] notifications on mount:',
  JSON.stringify(_allNotifs.slice(0, 3)),
)
console.log('[GiftCard] slug:', slug)
```

Run on device/simulator, place a gift card order, check logs to confirm no notification matches `CARD_ORDER_PAID + metadata.order === slug` on mount.

- [ ] **Step 2: Remove the debug logs**

Delete the two `console.log` lines and the `_allNotifs` declaration added in Step 1.

- [ ] **Step 3: Verify the happy path still works**

The success screen must still appear after actual payment:

1. Place a gift card order → arrives at payment screen → QR shown
2. Complete payment via bank transfer
3. FCM `CARD_ORDER_PAID` notification arrives with `metadata.order === slug`
4. Success screen (`GiftCardPaymentSuccessScreen`) should appear

If FCM is not testable in dev, verify via `order?.paymentStatus === CardOrderStatus.COMPLETED` path: manually set order status on backend to COMPLETED, then pull-to-refresh on payment screen → success screen should appear.

- [ ] **Step 4: Commit**

```bash
git add app/gift-card/checkout/\[slug\].tsx
git commit -m "chore(gift-card): remove debug logs after payment FCM fix"
```

(Only needed if you added debug logs. Skip if you skipped Step 1.)
