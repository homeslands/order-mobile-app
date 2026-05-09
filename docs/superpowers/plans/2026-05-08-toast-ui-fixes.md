# Toast UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three toast quality issues: solid icons, single-toast-at-a-time display, and correct type for foreground FCM notifications.

**Architecture:** Three targeted changes across three files. (1) Solid icons via `fill` + white `color` on lucide icons in `toast.tsx`. (2) Replace-all strategy in `toast-provider.tsx` — new toast replaces existing instead of stacking; also remove the never-rendered `title` field from `ToastData`. (3) FCM listener calls `showToastInternal` directly with `'info'` type instead of the i18n-translating `showToast` which hardcodes `'success'`.

**Tech Stack:** React Native, TypeScript, `react-native-reanimated`, `lucide-react-native`

---

## File Map

| File                                 | Change                                                 |
| ------------------------------------ | ------------------------------------------------------ |
| `components/ui/toast.tsx`            | Solid icons, remove `title` from `ToastData`           |
| `providers/toast-provider.tsx`       | Remove `title` from toast object, replace-all strategy |
| `hooks/use-notification-listener.ts` | Use `showToastInternal` with `'info'` type             |

---

### Task 1: Solid icons + remove unused `title` from `ToastData`

**Files:**

- Modify: `components/ui/toast.tsx`

- [ ] **Step 1: Read `components/ui/toast.tsx`**

Locate `ICON_MAP` (lines ~30–35) and `ToastData` interface (lines ~17–23).

- [ ] **Step 2: Update `ICON_MAP` with solid icons**

In lucide-react-native, passing `fill` fills the icon shape and `color` controls the inner symbol stroke. Setting `fill` to the icon color and `color` to `"#ffffff"` produces a solid colored circle with white inner symbol.

Replace the current `ICON_MAP`:

```tsx
const ICON_MAP = {
  error: <XCircle size={16} color="#ffffff" fill="#dc2626" />,
  success: <CheckCircle size={16} color="#ffffff" fill="#16a34a" />,
  warning: <AlertCircle size={16} color="#ffffff" fill="#d97706" />,
  info: <Info size={16} color="#ffffff" fill="#2563eb" />,
} as const
```

- [ ] **Step 3: Remove `title` from `ToastData`**

`title` is stored in `ToastData` but never rendered — `ToastItem` only renders `toast.message`. Remove it:

```tsx
interface ToastData {
  id: string
  message?: string
  type: 'info' | 'error' | 'success' | 'warning'
  duration: number
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: errors in `providers/toast-provider.tsx` because it still passes `title` to the `ToastData` object — this will be fixed in Task 2. If errors are only in that file, proceed to commit.

Actually, check: if typecheck errors exist only in `toast-provider.tsx` due to the `title` field being removed from `ToastData`, note them and fix in Task 2 Step 1. If typecheck errors exist elsewhere, fix them before committing.

- [ ] **Step 5: Commit**

```bash
git add components/ui/toast.tsx
git commit -m "fix(toast): solid icons, remove unused title from ToastData"
```

---

### Task 2: Remove `title` from toast provider + replace-all strategy

**Files:**

- Modify: `providers/toast-provider.tsx`

- [ ] **Step 1: Read `providers/toast-provider.tsx`**

Locate:

- The internal `showToast` callback (~line 42): creates `ToastData` with `title, message, type, duration, id`
- The `setToasts` call (~line 59): `setToasts((prev) => [...prev, newToast])`
- The `ToastContext` type (~line 14): `showToast(title, message, type)` signature

- [ ] **Step 2: Remove `title` from the created `ToastData` object**

The `showToastInternal` public API (used by `utils/toast.ts`) keeps its `(title, message, type)` signature unchanged so no callers need updating — `title` is accepted but not stored. Update only the object creation:

Replace:

```tsx
const newToast: ToastData = {
  id,
  title,
  message,
  type,
  duration,
}
```

With:

```tsx
const newToast: ToastData = {
  id,
  message,
  type,
  duration,
}
```

- [ ] **Step 3: Apply replace-all strategy**

When a new toast arrives, replace all existing toasts instead of appending. This ensures only one toast is visible at a time. The previous toast's `cancelAnimation` cleanup runs automatically when React unmounts it.

Replace:

```tsx
setToasts((prev) => [...prev, newToast])
```

With:

```tsx
setToasts([newToast])
```

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add providers/toast-provider.tsx
git commit -m "fix(toast): remove unused title field, show one toast at a time"
```

---

### Task 3: Fix FCM foreground notification toast type

**Files:**

- Modify: `hooks/use-notification-listener.ts`

- [ ] **Step 1: Read `hooks/use-notification-listener.ts`**

Locate the `messaging().onMessage` handler (~line 65). The current code:

```ts
import { showToast } from '@/utils'
// ...
if (body) showToast(body, title)
```

Two problems:

1. `showToast` from `@/utils` calls `i18n.t(body)` — `body` is a raw FCM string, not an i18n key. Works by accident via `defaultValue` fallback.
2. `showToast` hardcodes `'success'` type — all foreground notifications show a green checkmark regardless of content.

- [ ] **Step 2: Replace `showToast` with `showToastInternal`**

Change the import: remove `showToast` from `@/utils`, add `showToastInternal` from `@/providers/toast-provider`:

```ts
import { showToastInternal } from '@/providers/toast-provider'
```

Remove:

```ts
import { showToast } from '@/utils'
```

Change the toast call inside `onMessage`:

```ts
if (body) showToastInternal(title, body, 'info')
```

Full updated `onMessage` handler:

```ts
const unsubscribe = messaging().onMessage((remoteMessage) => {
  const payload = firebaseToPayload(remoteMessage)

  useNotificationStore
    .getState()
    .addNotification(payload, { markAsRead: false })

  const title = payload.notification?.title || 'Thông báo'
  const body = payload.notification?.body || ''
  if (body) showToastInternal(title, body, 'info')

  playNotificationSound().catch(() => {})
})
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-notification-listener.ts
git commit -m "fix(notification): show foreground FCM as info toast, not success"
```

---

## Manual Verification

After all tasks are committed, verify on device/simulator:

- [ ] **Solid icons:** trigger a success toast (`showToast('toast.imageSavedSuccess')`) → green filled circle with white checkmark
- [ ] **Solid icons:** trigger an error → red filled circle with white X
- [ ] **Single toast:** trigger two toasts in quick succession → only the second one appears, first is dismissed
- [ ] **FCM foreground:** receive a push notification while app is open → blue info icon (not green success)
