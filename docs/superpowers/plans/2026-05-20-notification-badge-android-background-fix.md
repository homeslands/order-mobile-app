# Notification Badge Android Background Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OS app icon badge increments correctly on Android for every notification that arrives while the app is backgrounded or killed.

**Architecture:** The root cause is that `setBackgroundMessageHandler` is currently a dummy stub — it runs on Android in background/killed state but does nothing, so `syncBadge` (which requires JS/foreground context) never fires for background notifications. The fix extracts a testable `incrementBadgeForBackgroundMessage` function from the handler, then implements it to call `getBadgeCountAsync() + 1`. On app open, the existing `hydrateFromApi → syncBadge` path already restores the exact unread count — this fix only closes the gap while the app is not open. iOS badge in background requires the backend to send the correct `apns.payload.aps.badge` value in the FCM payload; that is documented here but cannot be fixed from the app side.

**Tech Stack:** `@react-native-firebase/messaging`, `expo-notifications` (`getBadgeCountAsync`, `setBadgeCountAsync`), Jest

---

## Background & Diagnosis

### Badge sync flow (current)

| State                                       | OS App Icon Badge                                         | In-App Bell Badge              |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------ |
| App foreground, notification arrives        | ✅ `onMessage` → `addNotification` → `syncBadge(N)`       | ✅ Zustand `unreadCount`       |
| App background/killed, notification arrives | ❌ Background handler = empty → badge stays at last value | ❌ JS not running → stays at 0 |
| App opens (any case)                        | ✅ `hydrateFromApi` → `syncBadge(actual)` corrects        | ✅ `hydrateFromApi` corrects   |

### Why badge shows `1` but never increments to `2`

The backend sends FCM notification messages with a static `badge: 1` (or similar) in the APNs/FCM payload. iOS APNs uses this value to set the OS badge on every delivery — so every notification resets badge to `1` instead of incrementing. Android's `setBackgroundMessageHandler` is empty, so no badge update happens at all. In both cases, the correct count is only restored when `hydrateFromApi` runs on app open.

### iOS limitation

On iOS, `setBackgroundMessageHandler` does **not** run for FCM notification messages (messages with a `notification` field). The OS badge is set exclusively by `aps.badge` in the APNs payload — a value controlled by the backend. **App-side fix for iOS is not possible without a backend change.** The backend must send `apns.payload.aps.badge: <user_unread_count>` in each FCM message for iOS badge to be accurate in background.

---

## File Map

| File                                                | Change                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `lib/firebase-background-handler.ts`                | Export `incrementBadgeForBackgroundMessage` function; register it as the handler |
| `__tests__/lib/firebase-background-handler.test.ts` | New — 4 unit tests for the exported function                                     |

---

### Task 1: Write failing tests for badge increment

**Files:**

- Create: `__tests__/lib/firebase-background-handler.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// __tests__/lib/firebase-background-handler.test.ts
import * as Notifications from 'expo-notifications'

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: () => ({ setBackgroundMessageHandler: jest.fn() }),
}))

jest.mock('expo-notifications', () => ({
  getBadgeCountAsync: jest.fn(),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
}))

// Import after mocks — triggers module-level setBackgroundMessageHandler call
import { incrementBadgeForBackgroundMessage } from '../../lib/firebase-background-handler'

describe('incrementBadgeForBackgroundMessage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets badge to current + 1', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(2)
    await incrementBadgeForBackgroundMessage()
    expect(Notifications.getBadgeCountAsync).toHaveBeenCalledTimes(1)
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(3)
  })

  it('sets badge to 1 when current is 0', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(0)
    await incrementBadgeForBackgroundMessage()
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(1)
  })

  it('does not throw when getBadgeCountAsync fails', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockRejectedValue(
      new Error('badge unavailable'),
    )
    await expect(incrementBadgeForBackgroundMessage()).resolves.toBeUndefined()
    expect(Notifications.setBadgeCountAsync).not.toHaveBeenCalled()
  })

  it('does not throw when setBadgeCountAsync fails', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(1)
    ;(Notifications.setBadgeCountAsync as jest.Mock).mockRejectedValue(
      new Error('bridge error'),
    )
    await expect(incrementBadgeForBackgroundMessage()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to confirm all 4 tests fail**

```bash
npx jest __tests__/lib/firebase-background-handler.test.ts --no-coverage
```

Expected output:

```
FAIL __tests__/lib/firebase-background-handler.test.ts
  ● Test suite failed to run
    Cannot find module '../../lib/firebase-background-handler' ... export { incrementBadgeForBackgroundMessage }
```

---

### Task 2: Implement badge increment in the background handler

**Files:**

- Modify: `lib/firebase-background-handler.ts`

- [ ] **Step 1: Read the current file**

```bash
cat lib/firebase-background-handler.ts
```

Current content:

```ts
import messaging from '@react-native-firebase/messaging'

messaging().setBackgroundMessageHandler(async () => {
  // Intentionally empty ...
})
```

- [ ] **Step 2: Replace with the new implementation**

```ts
/**
 * Firebase background message handler.
 *
 * Android: runs in a headless JS context when a notification arrives while the
 * app is backgrounded or killed. We cannot update the Zustand store from here
 * (no React context), so we only increment the OS badge by 1. The exact unread
 * count is restored by syncBadge() via hydrateFromApi() the next time the app
 * comes to foreground.
 *
 * iOS: this handler does NOT fire for FCM notification messages (messages that
 * contain a `notification` field). On iOS, the OS badge is set directly from
 * `apns.payload.aps.badge` in the FCM payload — a value the backend controls.
 * To fix iOS badge accuracy in background, the backend must send the current
 * per-user unread count in that field.
 *
 * Why not empty anymore: the dummy stub caused Android badge to never update
 * while the app was closed, leaving the icon count stale until app open.
 */
import messaging from '@react-native-firebase/messaging'
import * as Notifications from 'expo-notifications'

export async function incrementBadgeForBackgroundMessage(): Promise<void> {
  try {
    const current = await Notifications.getBadgeCountAsync()
    await Notifications.setBadgeCountAsync(current + 1)
  } catch {
    // Badge update is best-effort — hydrateFromApi corrects on next app open.
  }
}

messaging().setBackgroundMessageHandler(incrementBadgeForBackgroundMessage)
```

- [ ] **Step 3: Run tests — all 4 must pass**

```bash
npx jest __tests__/lib/firebase-background-handler.test.ts --no-coverage
```

Expected output:

```
PASS __tests__/lib/firebase-background-handler.test.ts
  incrementBadgeForBackgroundMessage
    ✓ sets badge to current + 1
    ✓ sets badge to 1 when current is 0
    ✓ does not throw when getBadgeCountAsync fails
    ✓ does not throw when setBadgeCountAsync fails

Tests: 4 passed, 4 total
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/firebase-background-handler.ts __tests__/lib/firebase-background-handler.test.ts
git commit -m "fix(notification): increment OS badge on Android background message"
```

---

## Manual test checklist

After implementing, verify on a physical Android device:

1. **Badge increments per notification (Android)**
   - Clear all notifications → ensure app icon badge = 0
   - Kill the app completely
   - Send 1st notification → badge shows 1 ✓
   - Send 2nd notification → badge shows 2 ✓ _(was stuck at 1 before)_
   - Send 3rd notification → badge shows 3 ✓
   - Open app → `hydrateFromApi` runs → badge = actual unread count (may differ from 3 if any were already read on server) ✓

2. **Badge stays correct after app open**
   - Open notification screen → badge should reset to 0 (existing behavior via `setBadgeCountAsync(0)` in `app/notification/index.tsx:369`) ✓

3. **Bell badge matches OS badge after app opens**
   - Kill app → send 2 notifications → open app
   - OS badge = `hydrateFromApi` result ✓
   - Bell badge = Zustand `unreadCount` ✓
   - Both should show the same number ✓

## iOS note for backend

For iOS badge accuracy in background, the backend FCM message must include:

```json
{
  "apns": {
    "payload": {
      "aps": {
        "badge": "<user_unread_notification_count>"
      }
    }
  }
}
```

Until this is fixed on the backend, iOS badge will show the static value from the payload (currently `1`) for all background notifications. The badge corrects to the real unread count as soon as the user opens the app.
