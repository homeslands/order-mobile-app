# Notification Badge Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync the iOS app icon badge count with the actual unread notification count so it resets to 0 when the user opens the notification screen and updates correctly as notifications arrive.

**Architecture:** Two targeted changes: (1) call `Notifications.setBadgeCountAsync` at the three moments that change unread count inside the notification store, (2) clear badge to 0 when the notification screen mounts. No new files, no new abstractions — just calls to the existing expo-notifications API at the right moments.

**Tech Stack:** React Native, TypeScript, `expo-notifications` (`Notifications.setBadgeCountAsync`), Zustand (`stores/notification.store.ts`)

---

## Background

The notification store (`stores/notification.store.ts`) tracks all in-app notifications and their read state. The iOS system badge (number on the app icon) is currently set to auto-increment by the OS on each incoming notification but is **never cleared**. Three moments in the store must sync the badge:

| Moment                                       | Badge target     |
| -------------------------------------------- | ---------------- |
| `addNotification` — new notification arrives | `newUnreadCount` |
| `markAllAsRead` — user marks all as read     | `0`              |
| `clearAll` — logout / account switch         | `0`              |

One more moment: when the notification screen opens, badge must clear to `0` because the user has seen all notifications.

## File Map

| File                           | Change                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `stores/notification.store.ts` | Add `syncBadge` helper + call it in `addNotification`, `markAllAsRead`, `clearAll` |
| `app/notification/index.tsx`   | Add `useEffect` to clear badge on mount                                            |

---

### Task 1: Add badge sync to notification store

**Files:**

- Modify: `stores/notification.store.ts`

- [ ] **Step 1: Read `stores/notification.store.ts`**

Locate the three sections to modify:

- The import block at the top
- `addNotification` method (~line 106)
- `markAllAsRead` method (~line 126)
- `clearAll` method (~line 143)

- [ ] **Step 2: Add `expo-notifications` import and `syncBadge` helper**

At the top of the file, after the existing imports, add:

```ts
import * as Notifications from 'expo-notifications'
```

Then add this helper function directly above the `// ─── Store ──` comment:

```ts
function syncBadge(count: number): void {
  Notifications.setBadgeCountAsync(count).catch(() => {})
}
```

`syncBadge` is fire-and-forget — badge update is best-effort, never blocks notification logic.

- [ ] **Step 3: Update `addNotification`**

The current implementation:

```ts
addNotification: (payload, options) => {
  set((state) => {
    const item = transformPayloadToNotification(
      payload,
      options?.markAsRead ?? false,
    )
    // Dedup by slug, prepend new, cap at MAX
    const filtered = state.notifications.filter((n) => n.slug !== item.slug)
    return { notifications: [item, ...filtered].slice(0, MAX_NOTIFICATIONS) }
  })
},
```

Replace with:

```ts
addNotification: (payload, options) => {
  let newUnreadCount = 0
  set((state) => {
    const item = transformPayloadToNotification(
      payload,
      options?.markAsRead ?? false,
    )
    // Dedup by slug, prepend new, cap at MAX
    const filtered = state.notifications.filter((n) => n.slug !== item.slug)
    const updated = [item, ...filtered].slice(0, MAX_NOTIFICATIONS)
    newUnreadCount = updated.filter((n) => !n.isRead).length
    return { notifications: updated }
  })
  syncBadge(newUnreadCount)
},
```

Key: `newUnreadCount` is computed inside `set` (where the new state is known) then used outside to call `syncBadge` after the state update.

- [ ] **Step 4: Update `markAllAsRead`**

Current:

```ts
markAllAsRead: () => {
  const ts = new Date().toISOString()
  set((state) => ({
    markedAllReadAt: ts,
    notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
  }))
},
```

Replace with:

```ts
markAllAsRead: () => {
  const ts = new Date().toISOString()
  set((state) => ({
    markedAllReadAt: ts,
    notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
  }))
  syncBadge(0)
},
```

- [ ] **Step 5: Update `clearAll`**

Current:

```ts
clearAll: () => set({ notifications: [], markedAllReadAt: null }),
```

Replace with:

```ts
clearAll: () => {
  set({ notifications: [], markedAllReadAt: null })
  syncBadge(0)
},
```

- [ ] **Step 6: Run typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add stores/notification.store.ts
git commit -m "fix(notification): sync iOS badge count with unread notifications in store"
```

---

### Task 2: Clear badge when notification screen opens

**Files:**

- Modify: `app/notification/index.tsx`

- [ ] **Step 1: Read `app/notification/index.tsx`**

Locate:

- The import block at the top (~lines 1–31)
- The main screen component that contains the `useEffect` calls (~lines 310–370)
- Confirm `useEffect` is already imported from `'react'` (it is, line 6)

- [ ] **Step 2: Add `expo-notifications` import**

In `app/notification/index.tsx`, add this import after the `react-i18next` import line (currently line 16):

```ts
import * as Notifications from 'expo-notifications'
```

- [ ] **Step 3: Add `useEffect` to clear badge on mount**

Inside the main screen component (the one that reads from `useNotificationStore` at ~line 314), add this `useEffect` after the existing `useEffect` calls (~line 367):

```ts
useEffect(() => {
  Notifications.setBadgeCountAsync(0).catch(() => {})
}, [])
```

The empty dependency array means this runs once on mount — each time the user navigates to this screen (it's a stack screen that unmounts on back navigation, so mount = screen open).

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/notification/index.tsx
git commit -m "fix(notification): clear iOS badge when notification screen opens"
```

---

## Manual Verification

After both tasks are committed, test on a physical iOS device:

- [ ] **Badge increments:** Send a push notification while app is in background → badge number appears on icon
- [ ] **Badge clears on open:** Tap app icon (not the notification) → navigate to notification screen → badge disappears
- [ ] **Badge clears on logout:** Logout → badge clears (via `clearAll`)
- [ ] **Badge stays 0 in foreground:** Receive notification while app is open → toast shows but badge does NOT increment (foreground `addNotification` called with `markAsRead: false` but badge syncs to actual unread count in store)
