# FCM Round-4 Race Condition & Logout Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 race conditions and missing cleanup calls in the FCM push-notification flow that cause stale tokens, ghost registrations, and silent server leaks on logout.

**Architecture:** Each fix is a targeted, isolated change to one or two files. No new abstractions — just guard variables, cancellation flags, and missing function calls. All changes are backwards-compatible with the existing `useFirebaseToken` → `useRegisterDeviceToken` → `fcm-token-manager` pipeline.

**Tech Stack:** React Native, TypeScript, Zustand (`useUserStore`), `@react-native-firebase/messaging`, Expo Router

---

## File Map

| File                                  | Change                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| `hooks/use-firebase-token.ts`         | Reset `hasRunRef` in the `.then()` cancelled branch      |
| `hooks/use-register-device-token.ts`  | Add `cancelled` guard inside `run()` + return cleanup fn |
| `app/(tabs)/profile/general-info.tsx` | Call `cleanupTokenOnLogout` before `removeUserInfo()`    |
| `app/profile/index.tsx`               | Call `cleanupTokenOnLogout` before `removeUserInfo()`    |
| `lib/fcm-token-manager.ts`            | Add `isRefreshing` mutex to `checkAndRefresh`            |

---

### Task 1: Reset `hasRunRef` on cancellation in `use-firebase-token.ts`

**The bug:** When the component unmounts (e.g., fast logout → re-login), the `cancelled` flag is set to `true` by the cleanup function. The `.then()` handler checks `if (cancelled) return` — but it returns WITHOUT resetting `hasRunRef.current = false`. The ref stays `true` forever, so the next `enabled = true` cycle skips token fetch entirely. The `.catch()` handler already resets the ref but the `.then()` path does not.

**Files:**

- Modify: `hooks/use-firebase-token.ts:85-107`

- [ ] **Step 1: Open `hooks/use-firebase-token.ts` and locate the `.then()` + `.catch()` block**

It looks like this (lines ~84–107):

```ts
requestPermissionAndGetToken()
  .then(({ token: newToken, permissionDenied: denied }) => {
    if (cancelled) return // <-- BUG: hasRunRef stays true

    setPermissionDenied(denied)

    if (denied || !newToken) return

    setToken(newToken)
    // NOTE: Don't save to store here — only save AFTER server confirms registration
    // (handled in use-register-device-token.ts)
  })
  .catch((e) => {
    if (cancelled) return
    // eslint-disable-next-line no-console
    console.error('[FCM] requestPermissionAndGetToken rejected:', e)
    // Reset guard so the next enable=true cycle can retry
    hasRunRef.current = false
  })
```

- [ ] **Step 2: Apply the fix**

Replace the entire `.then()` + `.catch()` block with:

```ts
requestPermissionAndGetToken()
  .then(({ token: newToken, permissionDenied: denied }) => {
    if (cancelled) {
      hasRunRef.current = false
      return
    }

    setPermissionDenied(denied)

    if (denied || !newToken) return

    setToken(newToken)
    // NOTE: Don't save to store here — only save AFTER server confirms registration
    // (handled in use-register-device-token.ts)
  })
  .catch((e) => {
    hasRunRef.current = false
    if (cancelled) return
    // eslint-disable-next-line no-console
    console.error('[FCM] requestPermissionAndGetToken rejected:', e)
  })
```

Key changes:

- `.then()` cancelled branch: add `hasRunRef.current = false` before `return`
- `.catch()`: move `hasRunRef.current = false` to top (always reset, both cancelled and real errors), then early-return if cancelled before logging

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-firebase-token.ts
git commit -m "fix(notification): reset hasRunRef on cancellation in useFirebaseToken"
```

---

### Task 2: Add `cancelled` guard to `run()` in `use-register-device-token.ts`

**The bug:** When `enabled` goes to `false` (logout), React fires the effect cleanup — but there is no cleanup function returned. The `run()` async function is already in-flight. It will eventually call `setDeviceToken(token)` even though the user has logged out. This writes a stale token into the store of the freshly-logged-out session.

**Files:**

- Modify: `hooks/use-register-device-token.ts:26-57`

- [ ] **Step 1: Open `hooks/use-register-device-token.ts` and locate the `useEffect`**

It looks like this (lines ~26–57):

```ts
useEffect(() => {
  if (!enabled || !token || isRegistering.current) return
  // Token unchanged and already confirmed registered → skip
  if (token === storedToken) return

  isRegistering.current = true

  const run = async () => {
    try {
      // Unregister old token if different (best-effort)
      if (storedToken && storedToken !== token) {
        await unregisterToken(storedToken)
      }

      const result = await registerTokenWithRetry(token)

      if (result.success) {
        // Only save to store AFTER server confirms — this is the gate
        setDeviceToken(token)
      } else {
        // eslint-disable-next-line no-console
        console.error(
          '[FCM] Token registration failed permanently:',
          result.error,
        )
      }
    } finally {
      isRegistering.current = false
    }
  }

  run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [enabled, token])
```

- [ ] **Step 2: Apply the fix**

Replace the entire `useEffect` body with:

```ts
useEffect(() => {
  if (!enabled || !token || isRegistering.current) return
  // Token unchanged and already confirmed registered → skip
  if (token === storedToken) return

  isRegistering.current = true
  let cancelled = false

  const run = async () => {
    try {
      // Unregister old token if different (best-effort)
      if (storedToken && storedToken !== token) {
        await unregisterToken(storedToken)
      }
      if (cancelled) return

      const result = await registerTokenWithRetry(token)
      if (cancelled) return

      if (result.success) {
        // Only save to store AFTER server confirms — this is the gate
        setDeviceToken(token)
      } else {
        // eslint-disable-next-line no-console
        console.error(
          '[FCM] Token registration failed permanently:',
          result.error,
        )
      }
    } finally {
      isRegistering.current = false
    }
  }

  run()

  return () => {
    cancelled = true
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [enabled, token])
```

Key changes:

- Declare `let cancelled = false` after `isRegistering.current = true`
- Add `if (cancelled) return` after each `await` inside `run()` — before writing to store
- Return `() => { cancelled = true }` as effect cleanup so React sets it when `enabled` → `false`

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-register-device-token.ts
git commit -m "fix(notification): add cancelled guard to useRegisterDeviceToken run()"
```

---

### Task 3: Call `cleanupTokenOnLogout` in both logout handlers

**The bug:** Two separate logout paths exist in the app. Neither calls `cleanupTokenOnLogout`, so:

1. The FCM token is never unregistered from the server — the server keeps sending notifications to a logged-out device
2. `stopTokenRefreshScheduler()` is never called — the 24h interval and AppState listener keep running after logout

`cleanupTokenOnLogout` must be called BEFORE `removeUserInfo()` because `removeUserInfo()` clears `deviceToken` from the store, and `cleanupTokenOnLogout` reads `deviceToken` from the store when no argument is passed.

**Files:**

- Modify: `app/(tabs)/profile/general-info.tsx` — `handleLogoutConfirm` at line ~208
- Modify: `app/profile/index.tsx` — `handleLogout` at line ~147

#### Sub-task 3a: `app/(tabs)/profile/general-info.tsx`

- [ ] **Step 1: Add import for `cleanupTokenOnLogout`**

In `app/(tabs)/profile/general-info.tsx`, the existing imports end around line 27. Add this import after the `@/stores` import line (line 9):

```ts
import { cleanupTokenOnLogout } from '@/lib/fcm-token-manager'
```

The imports section should look like:

```ts
import { navigateNative } from '@/lib/navigation'
import { cleanupTokenOnLogout } from '@/lib/fcm-token-manager'
import { useAuthStore, useUserStore } from '@/stores'
```

- [ ] **Step 2: Update `handleLogoutConfirm`**

Find `handleLogoutConfirm` (around line 208). It currently looks like:

```ts
const handleLogoutConfirm = useCallback(() => {
  isLoggingOutRef.current = true
  setLogout()
  removeUserInfo()
  router.replace('/(tabs)/home' as never)
  showToast(tToast('logoutSuccess', 'Đăng xuất thành công'))
}, [removeUserInfo, router, setLogout, tToast])
```

Replace with:

```ts
const handleLogoutConfirm = useCallback(() => {
  isLoggingOutRef.current = true
  const capturedToken = useUserStore.getState().deviceToken
  cleanupTokenOnLogout(capturedToken).catch(() => {})
  setLogout()
  removeUserInfo()
  router.replace('/(tabs)/home' as never)
  showToast(tToast('logoutSuccess', 'Đăng xuất thành công'))
}, [removeUserInfo, router, setLogout, tToast])
```

Explanation of changes:

- `useUserStore.getState().deviceToken` — captures token imperatively BEFORE `removeUserInfo()` clears it
- `.catch(() => {})` — fire-and-forget: unregistration is best-effort; we don't block the UI on a network call
- `cleanupTokenOnLogout` is NOT added to `useCallback` deps because it is a stable module-level export (not reactive)

#### Sub-task 3b: `app/profile/index.tsx`

- [ ] **Step 3: Add import for `cleanupTokenOnLogout`**

In `app/profile/index.tsx`, the existing imports end around line 28. Add this import after the `@/stores` line (line 24):

```ts
import { cleanupTokenOnLogout } from '@/lib/fcm-token-manager'
```

The imports section should look like:

```ts
import { useAuthStore, useUserStore } from '@/stores'
import { cleanupTokenOnLogout } from '@/lib/fcm-token-manager'
```

- [ ] **Step 4: Update `handleLogout`**

Find `handleLogout` (around line 147). It currently looks like:

```ts
const handleLogout = useCallback(() => {
  setLogout()
  removeUserInfo()
  router.replace('/(tabs)/home' as never)
}, [router, removeUserInfo, setLogout])
```

Replace with:

```ts
const handleLogout = useCallback(() => {
  const capturedToken = useUserStore.getState().deviceToken
  cleanupTokenOnLogout(capturedToken).catch(() => {})
  setLogout()
  removeUserInfo()
  router.replace('/(tabs)/home' as never)
}, [router, removeUserInfo, setLogout])
```

- [ ] **Step 5: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/profile/general-info.tsx app/profile/index.tsx
git commit -m "fix(notification): call cleanupTokenOnLogout on all logout paths"
```

---

### Task 4: Add `isRefreshing` mutex to `checkAndRefresh` in `fcm-token-manager.ts`

**The bug:** `checkAndRefresh` is called from two places concurrently: the `setInterval` every 24h AND `AppState.addEventListener('change')` when the app comes to foreground. If both fire close together (e.g., interval fires 1ms before foreground), two concurrent `registerTokenWithRetry` calls race. Additionally, `onTokenRefresh` in `use-firebase-token.ts` may trigger a re-registration via `useRegisterDeviceToken` at the same time `checkAndRefresh` detects the same rotation.

The fix adds a module-level `isRefreshing` boolean that prevents concurrent execution of `checkAndRefresh`. The `try/finally` ensures it always resets.

**Files:**

- Modify: `lib/fcm-token-manager.ts:22-94`

- [ ] **Step 1: Add `isRefreshing` module variable**

Open `lib/fcm-token-manager.ts`. After the existing module-level variables (lines ~22–24):

```ts
let intervalId: ReturnType<typeof setInterval> | null = null
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null
```

Add one line:

```ts
let intervalId: ReturnType<typeof setInterval> | null = null
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null
let isRefreshing = false
```

- [ ] **Step 2: Wrap `checkAndRefresh` body in mutex + try/finally**

The current `checkAndRefresh` (lines ~51–94) looks like:

```ts
async function checkAndRefresh(): Promise<void> {
  const storedToken = useUserStore.getState().deviceToken
  if (!storedToken) return
  if (!Device.isDevice) return

  try {
    const currentToken = await messaging().getToken()

    if (currentToken !== storedToken) {
      const result = await registerTokenWithRetry(currentToken)
      if (result.success) {
        useUserStore.getState().setDeviceToken(currentToken)
        await setStoredTimestamp(Date.now())
      } else {
        // eslint-disable-next-line no-console
        console.error(
          '[FCM] Re-registration after token rotation failed:',
          result.error,
        )
      }
      return
    }

    const registeredAt = await getStoredTimestamp()
    if (!registeredAt) {
      await setStoredTimestamp(Date.now())
      return
    }

    const age = Date.now() - registeredAt
    if (age < TOKEN_REFRESH_THRESHOLD) return

    const result = await registerTokenWithRetry(currentToken)
    if (result.success) {
      await setStoredTimestamp(Date.now())
    } else {
      // eslint-disable-next-line no-console
      console.error(
        '[FCM] Re-registration of stale token failed:',
        result.error,
      )
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[FCM] checkAndRefresh failed:', e)
  }
}
```

Replace with:

```ts
async function checkAndRefresh(): Promise<void> {
  if (isRefreshing) return
  isRefreshing = true

  try {
    const storedToken = useUserStore.getState().deviceToken
    if (!storedToken || !Device.isDevice) return

    const currentToken = await messaging().getToken()

    if (currentToken !== storedToken) {
      const result = await registerTokenWithRetry(currentToken)
      if (result.success) {
        useUserStore.getState().setDeviceToken(currentToken)
        await setStoredTimestamp(Date.now())
      } else {
        // eslint-disable-next-line no-console
        console.error(
          '[FCM] Re-registration after token rotation failed:',
          result.error,
        )
      }
      return
    }

    const registeredAt = await getStoredTimestamp()
    if (!registeredAt) {
      await setStoredTimestamp(Date.now())
      return
    }

    const age = Date.now() - registeredAt
    if (age < TOKEN_REFRESH_THRESHOLD) return

    const result = await registerTokenWithRetry(currentToken)
    if (result.success) {
      await setStoredTimestamp(Date.now())
    } else {
      // eslint-disable-next-line no-console
      console.error(
        '[FCM] Re-registration of stale token failed:',
        result.error,
      )
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[FCM] checkAndRefresh failed:', e)
  } finally {
    isRefreshing = false
  }
}
```

Key changes:

- Added `if (isRefreshing) return` + `isRefreshing = true` at the top
- Moved `storedToken` / `Device.isDevice` early-exit guards into the `try` block (so `finally` always resets the flag)
- Combined `if (!storedToken) return` and `if (!Device.isDevice) return` into a single guard
- Added `finally { isRefreshing = false }` — always resets regardless of early return or throw

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/fcm-token-manager.ts
git commit -m "fix(notification): add isRefreshing mutex to prevent concurrent checkAndRefresh"
```

---

## Manual Verification Checklist

After all 4 tasks are committed, verify on a physical device:

- [ ] **Logout test (Task 1 + 2 + 3):**
  1. Login → grant notification permission → confirm FCM token registered (check server logs or console)
  2. Logout immediately (within 2s of login, before token registration completes)
  3. Re-login → verify new token is requested and registered (no "already running" skip)

- [ ] **Token registration no ghost writes (Task 2):**
  1. Login → trigger a token registration
  2. Logout while registration is in-flight
  3. Verify `setDeviceToken` is NOT called after logout (no token in store for logged-out user)

- [ ] **Server unregistration on logout (Task 3):**
  1. Login → confirm token registered on server
  2. Logout via profile screen (general-info.tsx path)
  3. Logout via the other profile screen (index.tsx path)
  4. Verify unregister API call is made (network tab / server logs) on each path

- [ ] **No concurrent checkAndRefresh (Task 4):**
  1. Background the app → immediately foreground it repeatedly
  2. Verify no double `registerTokenWithRetry` calls in console (no duplicate `[FCM] Re-registration` logs)
