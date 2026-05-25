# Notification Sync Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four notification inconsistencies: bell badge showing exact paginated count, OS badge resetting on screen open, `addNotification` ignoring bulk-read timestamp, and stale order-ready notifications flooding back on app reopen.

**Architecture:** All changes are confined to the Zustand notification store, one constants file, one hook, one component, and one screen. No new files needed. Each task is independently testable and committable.

**Tech Stack:** Zustand, React Native, expo-notifications, TypeScript strict

---

## Files Modified

| File                                                  | Change                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `components/notification/notification-bell.tsx`       | Cap badge display at 9+                                                                     |
| `constants/notification.constant.ts`                  | Export `ORDER_READY_MAX_AGE_MS`                                                             |
| `hooks/use-order-ready-queue.ts`                      | Import constant instead of defining locally                                                 |
| `stores/notification.store.ts`                        | `addNotification` respects `markedAllReadAt`; `hydrateFromApi` auto-marks stale order-ready |
| `app/notification/index.tsx`                          | Remove `setBadgeCountAsync(0)` and its import                                               |
| `__tests__/stores/notification-store-add.test.ts`     | New test for `markedAllReadAt` in `addNotification`                                         |
| `__tests__/stores/notification-store-hydrate.test.ts` | New test for stale order-ready in `hydrateFromApi`                                          |

---

## Task 1: Bell badge — cap display at 9+

**Why:** `unreadCount` in the store is derived from the in-memory list (max 50 items). The notification screen paginates: page 1 loads on bootstrap, pages 2+ load as the user scrolls. Each `hydrateFromApi` call can add more unread items, making `unreadCount` jump upward mid-session. Showing the exact number creates a confusing counter that changes when the user browses the list. Capping at 9+ hides the noise while still communicating "you have unread notifications."

**Files:**

- Modify: `components/notification/notification-bell.tsx:36`

- [ ] **Step 1: Change the threshold from 99 to 9**

In `components/notification/notification-bell.tsx`, replace line 36:

```tsx
// before
{
  unreadCount > 99 ? '99+' : unreadCount
}

// after
{
  unreadCount > 9 ? '9+' : unreadCount
}
```

- [ ] **Step 2: Run quality checks**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/notification/notification-bell.tsx
git commit -m "feat(notification): cap bell badge display at 9+"
```

---

## Task 2: Extract `ORDER_READY_MAX_AGE_MS` to shared constant

**Why:** The 60-minute staleness window is currently hardcoded in `hooks/use-order-ready-queue.ts`. The next task needs the same value in `stores/notification.store.ts`. Define it once in `constants/notification.constant.ts` so both files import from the same source.

**Files:**

- Modify: `constants/notification.constant.ts`
- Modify: `hooks/use-order-ready-queue.ts`

- [ ] **Step 1: Add the constant to `constants/notification.constant.ts`**

Append after the last export in the file:

```ts
/** ORDER_NEEDS_READY_TO_GET notifications older than this are treated as stale. */
export const ORDER_READY_MAX_AGE_MS = 60 * 60 * 1000 // 60 minutes
```

- [ ] **Step 2: Update the hook to import instead of defining locally**

In `hooks/use-order-ready-queue.ts`, replace:

```ts
const SUPPRESS_BUFFER_MS = 50
// ORDER_NEEDS_READY_TO_GET older than this are stale — order already picked up
// or abandoned. Prevents accumulated server-side unread records from flooding
// back as sheets on app reopen.
const ORDER_READY_MAX_AGE_MS = 60 * 60 * 1000 // 60 minutes
```

with:

```ts
import { markNotificationAsRead } from '@/api/notification'
import {
  NotificationMessageCode,
  ORDER_READY_MAX_AGE_MS,
} from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'

const SUPPRESS_BUFFER_MS = 50
```

(The `markNotificationAsRead` and `NotificationMessageCode` imports are already present — just add `ORDER_READY_MAX_AGE_MS` to the existing `@/constants/notification.constant` import line.)

Full updated import block for `hooks/use-order-ready-queue.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { markNotificationAsRead } from '@/api/notification'
import {
  NotificationMessageCode,
  ORDER_READY_MAX_AGE_MS,
} from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'
```

Remove the local `ORDER_READY_MAX_AGE_MS` constant definition (the comment block + `const` line).

- [ ] **Step 3: Run quality checks**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add constants/notification.constant.ts hooks/use-order-ready-queue.ts
git commit -m "refactor(notification): extract ORDER_READY_MAX_AGE_MS to shared constant"
```

---

## Task 3: `addNotification` respects `markedAllReadAt`

**Why:** If the user bulk-marks all notifications as read (via `markAllAsRead`), then an FCM arrives with a `createdAt` older than the bulk-read timestamp (common with server delivery delays), it is inserted as `isRead: false` — incorrectly incrementing `unreadCount`. The same guard already exists in `hydrateFromApi` but not in `addNotification`.

**Files:**

- Modify: `stores/notification.store.ts:126-144`
- Test: `__tests__/stores/notification-store-add.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/stores/notification-store-add.test.ts`:

```ts
it('marks incoming notification as read when createdAt is covered by markedAllReadAt', () => {
  const pastTs = new Date(Date.now() - 10_000).toISOString()
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    markedAllReadAt: new Date().toISOString(),
  })
  useNotificationStore.getState().addNotification({
    data: {
      slug: 'n-delayed',
      message: 'order-needs-processed',
      createdAt: pastTs,
    },
  })
  const n = useNotificationStore.getState().notifications[0]
  expect(n.isRead).toBe(true)
  expect(useNotificationStore.getState().unreadCount).toBe(0)
})

it('does NOT mark as read when createdAt is newer than markedAllReadAt', () => {
  const futureTs = new Date(Date.now() + 10_000).toISOString()
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    markedAllReadAt: new Date(Date.now() - 5_000).toISOString(),
  })
  useNotificationStore.getState().addNotification({
    data: {
      slug: 'n-new',
      message: 'order-needs-processed',
      createdAt: futureTs,
    },
  })
  const n = useNotificationStore.getState().notifications[0]
  expect(n.isRead).toBe(false)
  expect(useNotificationStore.getState().unreadCount).toBe(1)
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/stores/notification-store-add.test.ts --no-coverage
```

Expected: new tests FAIL, existing tests PASS.

- [ ] **Step 3: Implement the fix in `stores/notification.store.ts`**

Replace `addNotification` (lines 126-144):

```ts
addNotification: (payload, options) => {
  set((state) => {
    const rawItem = transformPayloadToNotification(
      payload,
      options?.markAsRead ?? false,
    )
    const existing = state.notifications.find((n) => n.slug === rawItem.slug)
    // isRead priority (highest → lowest):
    // 1. Local already marked read (duplicate FCM delivery)
    // 2. createdAt ≤ markedAllReadAt → bulk-read timestamp covers it
    // 3. Incoming value
    const bulkCovered =
      !!state.markedAllReadAt && rawItem.createdAt <= state.markedAllReadAt
    const item =
      existing?.isRead === true || bulkCovered
        ? { ...rawItem, isRead: true }
        : rawItem
    const filtered = state.notifications.filter((n) => n.slug !== item.slug)
    const updated = [item, ...filtered].slice(0, MAX_NOTIFICATIONS)
    let unreadCount = 0
    for (const n of updated) if (!n.isRead) unreadCount++
    return { notifications: updated, unreadCount }
  })
  syncBadge(get().unreadCount)
},
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest __tests__/stores/notification-store-add.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Run full quality check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add stores/notification.store.ts __tests__/stores/notification-store-add.test.ts
git commit -m "fix(notification): addNotification respects markedAllReadAt for delayed FCM"
```

---

## Task 4: `hydrateFromApi` auto-marks stale order-ready notifications as read

**Why:** When the app is killed without the customer interacting with the order-ready sheet, `markDone` never runs. On reopen, `hydrateFromApi` fetches all historical unread `ORDER_NEEDS_READY_TO_GET` from the server and presents a sheet for each one — even for orders from hours ago. Any notification older than `ORDER_READY_MAX_AGE_MS` (60 min) is no longer actionable: the food is gone or the order is resolved. Treat them as auto-read during hydration.

**Files:**

- Modify: `stores/notification.store.ts` — `hydrateFromApi` and add import
- Create: `__tests__/stores/notification-store-hydrate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/stores/notification-store-hydrate.test.ts`:

```ts
jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
}))

import { NotificationMessageCode } from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'
import type { INotification } from '@/types/notification.type'

const makeNotif = (
  overrides: Partial<INotification> & { slug: string },
): INotification => ({
  slug: overrides.slug,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  message: overrides.message ?? NotificationMessageCode.ORDER_NEEDS_PROCESSED,
  senderId: '',
  receiverId: 'user-1',
  type: 'system',
  isRead: overrides.isRead ?? false,
  metadata: {
    order: overrides.metadata?.order ?? 'order-1',
    orderType: '',
    tableName: '',
    table: '',
    branchName: 'Branch',
    branch: '',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    referenceNumber: 'REF',
  },
})

beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    markedAllReadAt: null,
  })
})

describe('hydrateFromApi — stale order-ready auto-mark', () => {
  it('marks ORDER_NEEDS_READY_TO_GET older than 60 min as read on hydration', () => {
    const staleTs = new Date(Date.now() - 61 * 60 * 1000).toISOString()
    useNotificationStore.getState().hydrateFromApi([
      makeNotif({
        slug: 'n-stale',
        createdAt: staleTs,
        isRead: false,
        message: NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      }),
    ])
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(true)
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('does NOT auto-mark ORDER_NEEDS_READY_TO_GET younger than 60 min as read', () => {
    const freshTs = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    useNotificationStore.getState().hydrateFromApi([
      makeNotif({
        slug: 'n-fresh',
        createdAt: freshTs,
        isRead: false,
        message: NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      }),
    ])
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(false)
    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })

  it('does NOT auto-mark other message types as read even if old', () => {
    const staleTs = new Date(Date.now() - 61 * 60 * 1000).toISOString()
    useNotificationStore.getState().hydrateFromApi([
      makeNotif({
        slug: 'n-other',
        createdAt: staleTs,
        isRead: false,
        message: NotificationMessageCode.ORDER_NEEDS_PROCESSED,
      }),
    ])
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(false)
    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/stores/notification-store-hydrate.test.ts --no-coverage
```

Expected: "marks ORDER_NEEDS_READY_TO_GET older than 60 min" FAILS. Others pass.

- [ ] **Step 3: Add import to `stores/notification.store.ts`**

At the top of `stores/notification.store.ts`, add to imports:

```ts
import {
  NotificationMessageCode,
  ORDER_READY_MAX_AGE_MS,
} from '@/constants/notification.constant'
```

- [ ] **Step 4: Update `hydrateFromApi` in `stores/notification.store.ts`**

Inside the `for (const n of items)` loop in `hydrateFromApi`, replace:

```ts
for (const n of items) {
  const local = map.get(n.slug)

  // isRead priority (highest → lowest):
  // 1. Local already marked read (optimistic individual/bulk)
  // 2. createdAt ≤ markedAllReadAt → bulk-read timestamp covers it
  // 3. Server value
  const bulkCovered = !!markedAllReadAt && n.createdAt <= markedAllReadAt
  const isRead = local?.isRead === true || bulkCovered || n.isRead

  map.set(n.slug, { ...n, isRead })
}
```

with:

```ts
const now = Date.now()
for (const n of items) {
  const local = map.get(n.slug)

  // isRead priority (highest → lowest):
  // 1. Local already marked read (optimistic individual/bulk)
  // 2. createdAt ≤ markedAllReadAt → bulk-read timestamp covers it
  // 3. ORDER_NEEDS_READY_TO_GET older than ORDER_READY_MAX_AGE_MS → stale
  // 4. Server value
  const bulkCovered = !!markedAllReadAt && n.createdAt <= markedAllReadAt
  const staleOrderReady =
    n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET &&
    now - Date.parse(n.createdAt) > ORDER_READY_MAX_AGE_MS
  const isRead =
    local?.isRead === true || bulkCovered || staleOrderReady || n.isRead

  map.set(n.slug, { ...n, isRead })
}
```

- [ ] **Step 5: Run tests**

```bash
npx jest __tests__/stores/notification-store-hydrate.test.ts --no-coverage
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Run full suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Run quality checks**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add stores/notification.store.ts __tests__/stores/notification-store-hydrate.test.ts
git commit -m "fix(notification): auto-mark stale ORDER_NEEDS_READY_TO_GET as read on hydration"
```

---

## Task 5: Remove `setBadgeCountAsync(0)` from notification screen

**Why:** The notification screen unconditionally resets the OS app badge to 0 on mount. The store's `syncBadge` already keeps the OS badge in sync with `unreadCount` via every mutator. This one-shot reset creates a mismatch: OS badge goes to 0, in-app bell still shows `unreadCount > 0`, then the next store mutation restores the OS badge — causing it to oscillate. Removing the override lets `syncBadge` be the single source of truth.

**Files:**

- Modify: `app/notification/index.tsx:17,368-370`

- [ ] **Step 1: Remove the `setBadgeCountAsync(0)` effect**

In `app/notification/index.tsx`, delete lines 368-370:

```ts
// DELETE this entire useEffect:
useEffect(() => {
  Notifications.setBadgeCountAsync(0).catch(() => {})
}, [])
```

- [ ] **Step 2: Remove the now-unused import**

`Notifications` from `expo-notifications` is only used by the deleted effect. Remove line 17:

```ts
// DELETE:
import * as Notifications from 'expo-notifications'
```

- [ ] **Step 3: Run quality checks**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/notification/index.tsx"
git commit -m "fix(notification): remove setBadgeCountAsync(0) that overrode store badge sync"
```

---

## Self-Review

**Spec coverage:**

- ✅ Bell badge 9+: Task 1
- ✅ `addNotification` markedAllReadAt: Task 3
- ✅ Stale ORDER_NEEDS_READY_TO_GET on hydrate: Task 4 (uses constant from Task 2)
- ✅ OS badge oscillation: Task 5
- ✅ Shared constant: Task 2

**Placeholder scan:** No TBD, no "add appropriate error handling", no "similar to Task N". All code blocks are complete.

**Type consistency:**

- `ORDER_READY_MAX_AGE_MS` defined in Task 2, used in Task 4's store code and already imported in the hook.
- `makeNotif` helper in Task 4 test matches `INotification` shape (slug, createdAt, message, senderId, receiverId, type, isRead, metadata with all required fields).
- `bulkCovered`, `staleOrderReady` variable names match between test description and implementation.
