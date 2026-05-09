# FCM Notification Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all silent-swallow catch blocks in the FCM notification flow with logged errors so production failures are diagnosable and — where structurally wrong — allow retry.

**Architecture:** Pure error-handling fixes across 6 files. No new abstractions, no API changes, no behavioral changes on the happy path. Each `catch {}` either gets an error parameter + `console.error`/`console.warn`, or gets a structural fix (reset retry guard, add `else` branch). All `console.*` calls use `// eslint-disable-next-line no-console` to pass ESLint.

**Tech Stack:** React Native, `@react-native-firebase/messaging`, `expo-notifications`, `expo-av`, Zustand

---

## File Map

| File                                 | Findings fixed    | Change type                     |
| ------------------------------------ | ----------------- | ------------------------------- |
| `hooks/use-firebase-token.ts`        | #1, #2, #4        | Structural + logging            |
| `hooks/use-register-device-token.ts` | #3                | Add `else` branch with logging  |
| `lib/fcm-token-manager.ts`           | #7, #8 + unlisted | Logging in 4 catch/else gaps    |
| `lib/notification-setup.ts`          | #5                | Error param in `.catch`         |
| `hooks/use-notification-listener.ts` | #6                | Error params in nested catches  |
| `hooks/use-notification-response.ts` | #9                | Add `.catch` to bare promise    |
| `lib/notification-navigation.ts`     | #10               | Error param in JSON.parse catch |

---

### Task 1: Fix use-firebase-token.ts (3 HIGH findings)

Three silent failures in the token acquisition path:

- **Finding 1**: retry loop swallows every error → `getToken` failing 5× returns same shape as "simulator"
- **Finding 2**: `.catch(() => {})` drops rejection AND permanently locks `hasRunRef` — no retry ever
- **Finding 4**: `registerDeviceForRemoteMessages` failure is invisible even though it will cause `getToken` to fail on iOS

**Files:**

- Modify: `hooks/use-firebase-token.ts`

- [ ] **Step 1: Apply all three fixes to `hooks/use-firebase-token.ts`**

Replace the entire file content with:

```ts
/**
 * useFirebaseToken — request notification permission + get FCM device token.
 *
 * - Only runs on physical device (simulator returns null)
 * - iOS: uses @react-native-firebase/messaging to get FCM token (not raw APNs token)
 * - Android: same Firebase SDK, already worked before
 * - Returns { token, permissionDenied } for upstream consumers
 */
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import messaging from '@react-native-firebase/messaging'

import { useUserStore } from '@/stores'

async function requestPermissionAndGetToken(): Promise<{
  token: string | null
  permissionDenied: boolean
}> {
  // Only real devices can receive push notifications
  if (!Device.isDevice) {
    return { token: null, permissionDenied: false }
  }

  if (Platform.OS === 'android') {
    // Android 13+ (API 33+): must request POST_NOTIFICATIONS at runtime.
    // messaging().requestPermission() does NOT trigger the system dialog on Android.
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      return { token: null, permissionDenied: true }
    }
  } else {
    // iOS: Firebase handles the permission dialog + APNs registration
    const authStatus = await messaging().requestPermission()
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    if (!granted) {
      return { token: null, permissionDenied: true }
    }
    try {
      await messaging().registerDeviceForRemoteMessages()
    } catch (e) {
      // APNs registration failure will cause getToken() to fail in the loop below
      // eslint-disable-next-line no-console
      console.error('[FCM] registerDeviceForRemoteMessages failed (iOS):', e)
    }
  }

  // Get FCM token — retry up to 5x with backoff (APNs token may arrive async on iOS)
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fcmToken = await messaging().getToken()
      return { token: fcmToken ?? null, permissionDenied: false }
    } catch (e) {
      lastError = e
      if (attempt < 4) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        )
      }
    }
  }
  // eslint-disable-next-line no-console
  console.error('[FCM] getToken failed after 5 attempts:', lastError)
  return { token: null, permissionDenied: false }
}

export function useFirebaseToken(enabled = true) {
  const [token, setToken] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const hasRunRef = useRef(false)

  const storedToken = useUserStore((s) => s.deviceToken)

  useEffect(() => {
    if (!enabled || hasRunRef.current) return
    hasRunRef.current = true

    let cancelled = false

    requestPermissionAndGetToken()
      .then(({ token: newToken, permissionDenied: denied }) => {
        if (cancelled) return

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

    return () => {
      cancelled = true
    }
  }, [enabled])

  // Listen for FCM token rotation (e.g. token invalidated while app is open)
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onTokenRefresh((newToken: string) => {
      if (!newToken) return
      setToken(newToken)
    })

    return unsubscribe
  }, [enabled])

  return { token, permissionDenied, storedToken }
}
```

- [ ] **Step 2: Run quality check**

```bash
npm run check
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-firebase-token.ts
git commit -m "fix(notification): log FCM token errors and reset retry guard on rejection

Three silent failures in use-firebase-token.ts:
- registerDeviceForRemoteMessages failure was invisible on iOS
- getToken retry loop swallowed all 5 errors with no log
- outer .catch dropped the rejection and permanently locked hasRunRef,
  preventing any retry in the same session"
```

---

### Task 2: Fix use-register-device-token.ts (Finding #3)

`registerTokenWithRetry` can return `{ success: false }` after 3 server retries. The `if (result.success)` block has no `else` — the failure is silently dropped, `setDeviceToken` is never called, and the user permanently stops receiving notifications with zero diagnostic signal.

**Files:**

- Modify: `hooks/use-register-device-token.ts`

- [ ] **Step 1: Add `else` branch to the `if (result.success)` check**

Open `hooks/use-register-device-token.ts`. The current `run` function at lines 33–49:

```ts
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
    }
  } finally {
    isRegistering.current = false
  }
}
```

Replace with:

```ts
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
```

- [ ] **Step 2: Run quality check**

```bash
npm run check
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-register-device-token.ts
git commit -m "fix(notification): log token registration failure in use-register-device-token

result.success === false was silently discarded — user permanently stopped
receiving notifications with no log. Added else branch to surface the error."
```

---

### Task 3: Fix fcm-token-manager.ts (Findings #7, #8 + two unlisted gaps)

Four silent failure points in the token refresh scheduler:

- **Finding 7**: `checkAndRefresh` outer catch is empty — a crashing refresh logs nothing
- **Finding 8**: `setStoredTimestamp` catch is empty — storage failure silently disables the 48h refresh scheduler
- **Unlisted gap A**: `result.success === false` after token rotation re-registration has no `else`
- **Unlisted gap B**: `result.success === false` after stale token re-registration has no `else`

**Files:**

- Modify: `lib/fcm-token-manager.ts`

- [ ] **Step 1: Fix `setStoredTimestamp` (Finding #8)**

Current `setStoredTimestamp` (lines 39–47):

```ts
async function setStoredTimestamp(ts: number): Promise<void> {
  try {
    const { createSafeStorage } = await import('@/utils/storage')
    const storage = createSafeStorage()
    storage.setItem(STORAGE_KEY_TIMESTAMP, String(ts))
  } catch {
    // Silent fail
  }
}
```

Replace with:

```ts
async function setStoredTimestamp(ts: number): Promise<void> {
  try {
    const { createSafeStorage } = await import('@/utils/storage')
    const storage = createSafeStorage()
    storage.setItem(STORAGE_KEY_TIMESTAMP, String(ts))
  } catch (e) {
    // Storage failure disables the 48h stale-token refresh until next cold start
    // eslint-disable-next-line no-console
    console.error('[FCM] setStoredTimestamp failed:', e)
  }
}
```

- [ ] **Step 2: Fix `checkAndRefresh` — outer catch + two `result.success === false` gaps**

Current `checkAndRefresh` (lines 49–85):

```ts
async function checkAndRefresh(): Promise<void> {
  const storedToken = useUserStore.getState().deviceToken
  if (!storedToken) return
  if (!Device.isDevice) return

  try {
    const currentToken = await messaging().getToken()

    if (currentToken !== storedToken) {
      // Firebase rotated the token — re-register immediately regardless of age
      const result = await registerTokenWithRetry(currentToken)
      if (result.success) {
        useUserStore.getState().setDeviceToken(currentToken)
        await setStoredTimestamp(Date.now())
      }
      return
    }

    // Token unchanged — only refresh if older than threshold
    const registeredAt = await getStoredTimestamp()
    if (!registeredAt) {
      await setStoredTimestamp(Date.now())
      return
    }

    const age = Date.now() - registeredAt
    if (age < TOKEN_REFRESH_THRESHOLD) return

    // Token is stale — re-register to keep server in sync
    const result = await registerTokenWithRetry(currentToken)
    if (result.success) {
      await setStoredTimestamp(Date.now())
    }
  } catch {
    // Silent fail — refresh will be retried on next interval/foreground
  }
}
```

Replace with:

```ts
async function checkAndRefresh(): Promise<void> {
  const storedToken = useUserStore.getState().deviceToken
  if (!storedToken) return
  if (!Device.isDevice) return

  try {
    const currentToken = await messaging().getToken()

    if (currentToken !== storedToken) {
      // Firebase rotated the token — re-register immediately regardless of age
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

    // Token unchanged — only refresh if older than threshold
    const registeredAt = await getStoredTimestamp()
    if (!registeredAt) {
      await setStoredTimestamp(Date.now())
      return
    }

    const age = Date.now() - registeredAt
    if (age < TOKEN_REFRESH_THRESHOLD) return

    // Token is stale — re-register to keep server in sync
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

- [ ] **Step 3: Run quality check**

```bash
npm run check
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add lib/fcm-token-manager.ts
git commit -m "fix(notification): log errors in FCM token refresh scheduler

Four silent failures in fcm-token-manager.ts:
- checkAndRefresh outer catch dropped all errors with no log
- setStoredTimestamp silently failed, disabling the 48h refresh scheduler
- two result.success === false branches had no else — token rotation and
  stale-token re-registration failures were invisible"
```

---

### Task 4: Fix remaining MED findings in 4 files

Four small catch blocks across 4 files each get an error parameter + log. All the same pattern — no structural change, just observability.

**Files:**

- Modify: `lib/notification-setup.ts` (Finding #5)
- Modify: `hooks/use-notification-listener.ts` (Finding #6)
- Modify: `hooks/use-notification-response.ts` (Finding #9)
- Modify: `lib/notification-navigation.ts` (Finding #10)

- [ ] **Step 1: Fix `lib/notification-setup.ts` — Android channel creation (Finding #5)**

Current lines 18–26 in `lib/notification-setup.ts`:

```ts
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7A737',
    sound: 'notification.mp3',
  }).catch(() => {})
}
```

Replace with:

```ts
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7A737',
    sound: 'notification.mp3',
    // eslint-disable-next-line no-console
  }).catch((e) =>
    console.error(
      '[Notifications] Failed to create Android default channel:',
      e,
    ),
  )
}
```

- [ ] **Step 2: Fix `hooks/use-notification-listener.ts` — nested audio catches (Finding #6)**

Current `playNotificationSound` function (lines 24–44):

```ts
async function playNotificationSound(): Promise<void> {
  try {
    if (!cachedSound) {
      const { sound } = await Audio.Sound.createAsync(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@/assets/sound/notification.mp3') as AVPlaybackSource,
      )
      cachedSound = sound
    }
    await cachedSound.setPositionAsync(0)
    await cachedSound.setVolumeAsync(SOUND_VOLUME)
    await cachedSound.playAsync()
  } catch {
    // Unload native audio resource before clearing reference to prevent
    // orphaned buffers in the native Audio engine
    if (cachedSound) {
      await cachedSound.unloadAsync().catch(() => {})
    }
    cachedSound = null
  }
}
```

Replace with:

```ts
async function playNotificationSound(): Promise<void> {
  try {
    if (!cachedSound) {
      const { sound } = await Audio.Sound.createAsync(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@/assets/sound/notification.mp3') as AVPlaybackSource,
      )
      cachedSound = sound
    }
    await cachedSound.setPositionAsync(0)
    await cachedSound.setVolumeAsync(SOUND_VOLUME)
    await cachedSound.playAsync()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound playback failed:', e)
    // Unload native audio resource before clearing reference to prevent
    // orphaned buffers in the native Audio engine
    if (cachedSound) {
      // eslint-disable-next-line no-console
      await cachedSound
        .unloadAsync()
        .catch((unloadErr) =>
          console.warn('[Audio] Failed to unload sound:', unloadErr),
        )
    }
    cachedSound = null
  }
}
```

- [ ] **Step 3: Fix `hooks/use-notification-response.ts` — bare promise (Finding #9)**

Current lines 63–66 in `hooks/use-notification-response.ts`:

```ts
// Cold start: check if app was opened by tapping a notification
Notifications.getLastNotificationResponseAsync().then((response) => {
  if (response) handleResponse(response)
})
```

Replace with:

```ts
// Cold start: check if app was opened by tapping a notification
Notifications.getLastNotificationResponseAsync()
  .then((response) => {
    if (response) handleResponse(response)
  })
  // eslint-disable-next-line no-console
  .catch((e) =>
    console.warn('[Notifications] getLastNotificationResponseAsync failed:', e),
  )
```

- [ ] **Step 4: Fix `lib/notification-navigation.ts` — JSON.parse catch (Finding #10)**

Current lines 26–31 in `lib/notification-navigation.ts`:

```ts
if (data.payload && typeof data.payload === 'string') {
  try {
    parsed = JSON.parse(data.payload) as Record<string, string>
  } catch {
    // Ignore
  }
}
```

Replace with:

```ts
if (data.payload && typeof data.payload === 'string') {
  try {
    parsed = JSON.parse(data.payload) as Record<string, string>
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Notifications] Failed to parse notification payload:',
      data.payload,
      e,
    )
  }
}
```

- [ ] **Step 5: Run quality check**

```bash
npm run check
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add lib/notification-setup.ts hooks/use-notification-listener.ts hooks/use-notification-response.ts lib/notification-navigation.ts
git commit -m "fix(notification): log errors in 4 remaining silent catch blocks

- notification-setup.ts: Android channel creation failure now logged
- use-notification-listener.ts: audio playback + unload errors now logged
- use-notification-response.ts: getLastNotificationResponseAsync rejection caught
- notification-navigation.ts: JSON.parse failure on notification payload now logged"
```

---

## Self-Review

**Spec coverage:**

- Finding 1 ✅ Task 1 — `lastError` captured, logged after 5 attempts
- Finding 2 ✅ Task 1 — `.catch` gets `(e)`, logs it, resets `hasRunRef.current = false`
- Finding 3 ✅ Task 2 — `else` branch added to `if (result.success)`
- Finding 4 ✅ Task 1 — `catch` gets `(e)` + `console.error`
- Finding 5 ✅ Task 4 — `.catch(() => {})` → `.catch((e) => console.error(...))`
- Finding 6 ✅ Task 4 — both nested catches get error params + logs
- Finding 7 ✅ Task 3 — outer `catch` gets `(e)` + `console.error`
- Finding 8 ✅ Task 3 — `setStoredTimestamp` catch gets `(e)` + `console.error`
- Finding 9 ✅ Task 4 — `.catch` added to bare `.then` promise
- Finding 10 ✅ Task 4 — JSON.parse catch gets `(e)` + `console.warn`
- Unlisted gap A ✅ Task 3 — `else` added to token-rotation re-registration
- Unlisted gap B ✅ Task 3 — `else` added to stale-token re-registration
