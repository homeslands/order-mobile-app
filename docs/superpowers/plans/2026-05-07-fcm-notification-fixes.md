# FCM Notification Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all FCM push notification bugs on both Android and iOS — background handler placement, sound channel mismatch, duplicate foreground listeners, and debug log leaks.

**Architecture:** Five independent, surgical fixes applied in dependency order. No new abstractions introduced. All changes are in `index.js`, `app/_layout.tsx`, `hooks/use-firebase-token.ts`, and `hooks/use-notification-listener.ts`.

**Tech Stack:** `@react-native-firebase/messaging` v24, `expo-notifications`, React Native, Expo Router

---

## File Map

| File | Change |
|------|--------|
| `index.js` | Add `firebase-background-handler` import (first line) |
| `app/_layout.tsx` | Remove `firebase-background-handler` import |
| `hooks/use-firebase-token.ts` | Fix sound name `notification.wav` → `notification.mp3`; remove console.log/warn statements |
| `hooks/use-notification-listener.ts` | Remove duplicate `addNotificationReceivedListener` block — keep only `messaging().onMessage()` |

---

### Task 1: Move firebase background handler to entry point

The background handler MUST be registered before React starts. Currently it is imported inside `app/_layout.tsx` (a React component), which means it is only registered after the React tree mounts. Messages received while the app is killed or in background before the JS bundle hydrates are dropped.

**Files:**
- Modify: `index.js`
- Modify: `app/_layout.tsx`
- Modify: `lib/firebase-background-handler.ts`

- [ ] **Step 1: Open `index.js` and add the background handler as the very first import**

Current `index.js`:
```js
import './lib/navigation-setup'
import 'expo-router/entry'
```

Replace with:
```js
import './lib/firebase-background-handler'
import './lib/navigation-setup'
import 'expo-router/entry'
```

The order matters: `firebase-background-handler` must be first so `setBackgroundMessageHandler` is registered before any other module runs.

- [ ] **Step 2: Remove the same import from `app/_layout.tsx`**

In `app/_layout.tsx`, delete line 1:
```ts
import '@/lib/firebase-background-handler'
```

After the edit the first import in `_layout.tsx` should be `import { BottomSheetModalProvider } ...`.

- [ ] **Step 3: Verify `lib/firebase-background-handler.ts` content is correct**

File should read exactly:
```ts
import messaging from '@react-native-firebase/messaging'

messaging().setBackgroundMessageHandler(async () => {})
```

No changes needed if it already matches.

- [ ] **Step 4: Verify build compiles cleanly**

```bash
npm run check
```

Expected: exits 0, no TypeScript or lint errors.

- [ ] **Step 5: Commit**

```bash
git add index.js app/_layout.tsx
git commit -m "fix(notification): move FCM background handler to entry point

setBackgroundMessageHandler must be registered at module level before
React starts. _layout.tsx is mounted after hydration — messages received
in killed/background state were silently dropped."
```

---

### Task 2: Fix Android notification sound channel name

The notification channel is created with `sound: 'notification.wav'` but the actual file in `android/app/src/main/res/raw/` is `notification.mp3`. Android silently falls back to the default system sound when the named file is not found, so custom sound never plays.

**Files:**
- Modify: `hooks/use-firebase-token.ts:47`

- [ ] **Step 1: Open `hooks/use-firebase-token.ts` and fix the sound name**

Find the block at lines 41–49:
```ts
if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7A737',
    sound: 'notification.wav',
  })
}
```

Change `'notification.wav'` to `'notification.mp3'`:
```ts
if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7A737',
    sound: 'notification.mp3',
  })
}
```

- [ ] **Step 2: Verify sound file exists in Android raw directory**

```bash
ls android/app/src/main/res/raw/
```

Expected output must include `notification.mp3`. If the file is missing, copy it:
```bash
cp assets/sound/notification.mp3 android/app/src/main/res/raw/notification.mp3
```

- [ ] **Step 3: Verify type check passes**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-firebase-token.ts
git commit -m "fix(notification): fix Android channel sound name wav→mp3

Channel was created referencing notification.wav but only notification.mp3
exists in res/raw/. Android silently ignores missing sound file and falls
back to default system sound."
```

---

### Task 3: Remove duplicate foreground notification listener

`hooks/use-notification-listener.ts` registers TWO listeners for foreground notifications:
1. `messaging().onMessage()` — Firebase SDK, fires for FCM messages on both platforms
2. `Notifications.addNotificationReceivedListener()` — expo-notifications, also fires for FCM messages on Android

On Android, both fire for the same message, causing duplicate toast popups and double sound playback. The Firebase `onMessage` listener is the correct one to keep — it handles both Android and iOS identically and receives the full Firebase payload.

**Files:**
- Modify: `hooks/use-notification-listener.ts`

- [ ] **Step 1: Open `hooks/use-notification-listener.ts` and remove the expo-notifications listener block**

The file currently has two `useEffect` blocks after the Firebase `onMessage` block. Remove the entire second `useEffect` (lines 101–132 approximately):

```ts
// DELETE THIS ENTIRE BLOCK:
useEffect(() => {
  if (!enabled) return

  // Foreground notification received
  listenerRef.current = Notifications.addNotificationReceivedListener(
    (notification) => {
      // eslint-disable-next-line no-console
      console.log('[FCM] Foreground notification received:', JSON.stringify(notification.request.content))
      const payload = expoToPayload(notification)

      // Add to store
      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      // Toast
      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) {
        showToast(body, title)
      }

      // Sound
      playNotificationSound().catch(() => {})
    },
  )

  return () => {
    listenerRef.current?.remove()
    listenerRef.current = null
  }
}, [enabled])
```

- [ ] **Step 2: Remove now-unused imports and variables**

After removing the block, also remove:
- `listenerRef` declaration: `const listenerRef = useRef<Notifications.EventSubscription | null>(null)`
- `expoToPayload` function (lines 47–61 approximately)
- The `import * as Notifications from 'expo-notifications'` import at top if it has no other usages
- The `useRef` import from React if it is no longer used

The final `hooks/use-notification-listener.ts` should look like:

```ts
/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - Shows toast with title + body
 * - Plays notification sound (volume 0.5)
 */
import { Audio, type AVPlaybackSource } from 'expo-av'
import { useEffect } from 'react'
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging'

import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToast } from '@/utils'

const SOUND_VOLUME = 0.5

let cachedSound: Audio.Sound | null = null

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
    if (cachedSound) {
      await cachedSound.unloadAsync().catch(() => {})
    }
    cachedSound = null
  }
}

function firebaseToPayload(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): NotificationPayload {
  const data = (remoteMessage.data ?? {}) as Record<string, string>
  return {
    notification: {
      title: remoteMessage.notification?.title ?? undefined,
      body: remoteMessage.notification?.body ?? undefined,
    },
    data,
    messageId: remoteMessage.messageId ?? undefined,
  }
}

export function useNotificationListener(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) showToast(body, title)

      playNotificationSound().catch(() => {})
    })

    return unsubscribe
  }, [enabled])
}
```

- [ ] **Step 3: Check types**

```bash
npm run check
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-notification-listener.ts
git commit -m "fix(notification): remove duplicate expo-notifications foreground listener

Both messaging().onMessage() and addNotificationReceivedListener fired
for the same FCM message on Android, causing duplicate toasts and double
sound playback. Keeping only the Firebase onMessage handler which works
identically on both platforms."
```

---

### Task 4: Remove debug console.log statements from use-firebase-token.ts

The pre-commit hook blocks commits containing `console.log` in TS/TSX files. Current `hooks/use-firebase-token.ts` has three debug statements added during debugging that must be removed before any future commit touching this file.

**Files:**
- Modify: `hooks/use-firebase-token.ts`

- [ ] **Step 1: Remove the three debug console statements**

Remove line containing:
```ts
// eslint-disable-next-line no-console
console.warn('[FCM] Push notifications are not supported on simulator')
```

Remove lines containing:
```ts
// eslint-disable-next-line no-console
console.log('[FCM] Permission status:', authStatus, {
  AUTHORIZED: messaging.AuthorizationStatus.AUTHORIZED,
  PROVISIONAL: messaging.AuthorizationStatus.PROVISIONAL,
  DENIED: messaging.AuthorizationStatus.DENIED,
})
```

Remove lines containing:
```ts
// eslint-disable-next-line no-console
console.log('[FCM] token:', fcmToken)
```

Remove lines containing:
```ts
// eslint-disable-next-line no-console
console.error('[FCM] Failed to get FCM token after 5 attempts')
```

- [ ] **Step 2: The resulting `requestPermissionAndGetToken` function should look like this**

```ts
async function requestPermissionAndGetToken(): Promise<{
  token: string | null
  permissionDenied: boolean
}> {
  if (!Device.isDevice) {
    return { token: null, permissionDenied: false }
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F7A737',
      sound: 'notification.mp3',
    })
  }

  const authStatus = await messaging().requestPermission()
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL

  if (!granted) {
    return { token: null, permissionDenied: true }
  }

  if (Platform.OS === 'ios') {
    await messaging().registerDeviceForRemoteMessages()
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fcmToken = await messaging().getToken()
      return { token: fcmToken ?? null, permissionDenied: false }
    } catch {
      if (attempt < 4) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        )
      }
    }
  }
  return { token: null, permissionDenied: false }
}
```

- [ ] **Step 3: Run quality check**

```bash
npm run check
```

Expected: exits 0. Pre-commit hook will also verify no `console.log` remains.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-firebase-token.ts
git commit -m "chore(notification): remove debug console logs from FCM token hook"
```

---

## Manual Verification Checklist

After all tasks are committed, verify on a physical device:

**Android:**
- [ ] Build and install a fresh APK: `expo run:android`
- [ ] Grant notification permission when prompted
- [ ] Send a test notification from Firebase Console → Messaging → Send test message
- [ ] Verify: OS notification appears in system tray when app is in background
- [ ] Verify: Toast + custom sound play when app is in foreground
- [ ] Verify: Only ONE toast appears (not two)

**iOS (physical device, development build):**
- [ ] Build and install: `expo run:ios --device`
- [ ] Grant notification permission when prompted on first launch
- [ ] Confirm in Xcode console that FCM token is registered (check server logs)
- [ ] Send a test notification from Firebase Console
- [ ] Verify: OS notification appears when app is in background/killed
- [ ] Verify: Toast + sound play when app is in foreground

**iOS background note:** If iOS background notifications still don't appear after these fixes, the issue is likely APNs environment routing — the Firebase project must have the APNs Auth Key uploaded under Project Settings → Cloud Messaging → iOS app → APNs Authentication Key. The entitlement `aps-environment: development` must be present in the app's `.entitlements` file for sandbox (development build) delivery.
