# FCM Notification Fixes Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining FCM push notification bugs — iOS foreground suppression, background wakeup, entitlements routing, module-level setup placement, and debug log cleanup.

**Architecture:** Four independent surgical fixes. No new abstractions. All changes are in `app.json`, `index.js`, `lib/notification-setup.ts` (new), `lib/firebase-background-handler.ts`, `hooks/use-firebase-token.ts`, `lib/fcm-token-registration.ts`, and `ios/TRENDCoffee/TRENDCoffee.entitlements`.

**Tech Stack:** `@react-native-firebase/messaging` v24, `expo-notifications`, Expo Router, React Native, APNs

---

## File Map

| File                                       | Change                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `app.json`                                 | Add `UIBackgroundModes: ["remote-notification", "fetch"]` to `ios.infoPlist`                            |
| `firebase.json`                            | Create — set `messaging_ios_foreground_presentation_options: ["badge"]`                                 |
| `lib/notification-setup.ts`                | Create — `setNotificationHandler` + Android `setNotificationChannelAsync`                               |
| `index.js`                                 | Add `./lib/notification-setup` import after firebase-background-handler                                 |
| `hooks/use-firebase-token.ts`              | Remove `setNotificationHandler` block + `setNotificationChannelAsync` call + all console.log statements |
| `lib/firebase-background-handler.ts`       | Remove console.log from background handler                                                              |
| `lib/fcm-token-registration.ts`            | Remove 3 debug console statements                                                                       |
| `ios/TRENDCoffee/TRENDCoffee.entitlements` | Remove `aps-environment` key (let Xcode manage per build config)                                        |

---

### Task 1: Add UIBackgroundModes and create firebase.json

**Why:** iOS will not wake the app JS runtime for background/data messages unless `UIBackgroundModes: remote-notification` is declared in `Info.plist`. Without it, `setBackgroundMessageHandler` never fires for killed/background state. Additionally, Firebase's `UNUserNotificationCenterDelegate.willPresentNotification` defaults to `completionHandler(.none)` when `firebase.json` is absent, which silently suppresses all foreground notification banners/sounds.

**Files:**

- Modify: `app.json`
- Create: `firebase.json`

- [ ] **Step 1: Add UIBackgroundModes to app.json ios.infoPlist**

Open `app.json`. The `ios.infoPlist` section currently reads:

```json
"infoPlist": {
  "NSCameraUsageDescription": "Cho phép ứng dụng sử dụng camera để chụp ảnh đại diện.",
  "NSPhotoLibraryUsageDescription": "Cho phép ứng dụng truy cập thư viện ảnh để chọn ảnh đại diện.",
  "NSPhotoLibraryAddUsageDescription": "Cho phép ứng dụng lưu ảnh hoá đơn và mã QR thanh toán vào thư viện ảnh.",
  "ITSAppUsesNonExemptEncryption": false
}
```

Add `UIBackgroundModes` so it reads:

```json
"infoPlist": {
  "NSCameraUsageDescription": "Cho phép ứng dụng sử dụng camera để chụp ảnh đại diện.",
  "NSPhotoLibraryUsageDescription": "Cho phép ứng dụng truy cập thư viện ảnh để chọn ảnh đại diện.",
  "NSPhotoLibraryAddUsageDescription": "Cho phép ứng dụng lưu ảnh hoá đơn và mã QR thanh toán vào thư viện ảnh.",
  "ITSAppUsesNonExemptEncryption": false,
  "UIBackgroundModes": ["remote-notification", "fetch"]
}
```

- [ ] **Step 2: Create firebase.json at project root**

Create `firebase.json` with this exact content:

```json
{
  "react-native": {
    "messaging_ios_foreground_presentation_options": ["badge"]
  }
}
```

This tells Firebase's `UNUserNotificationCenterDelegate` to call `completionHandler(UNNotificationPresentationOptionBadge)` instead of `completionHandler(.none)`, which allows the OS to show banners and play sounds for foreground notifications. `alert` and `sound` are intentionally omitted — the app's own `onMessage` handler shows a custom toast + plays sound instead.

- [ ] **Step 3: Verify the files were written correctly**

```bash
cat firebase.json
```

Expected output:

```json
{
  "react-native": {
    "messaging_ios_foreground_presentation_options": ["badge"]
  }
}
```

```bash
node -e "const a=require('./app.json'); console.log(JSON.stringify(a.expo.ios.infoPlist.UIBackgroundModes))"
```

Expected output:

```
["remote-notification","fetch"]
```

- [ ] **Step 4: Commit**

```bash
git add app.json firebase.json
git commit -m "fix(notification): add UIBackgroundModes and firebase.json for iOS

UIBackgroundModes remote-notification is required for iOS to wake the JS
runtime on background/data push messages. firebase.json prevents Firebase
from suppressing foreground notification banners via completionHandler(.none)."
```

---

### Task 2: Move notification setup to index.js; clean use-firebase-token.ts

**Why:** `Notifications.setNotificationHandler` must be called before any React component mounts — currently it is at module scope in `use-firebase-token.ts` which only loads when `useFirebaseToken` is first rendered (after auth). Similarly, `setNotificationChannelAsync` is called inside `requestPermissionAndGetToken()` which is gated on the user being authenticated — background notifications received before first login are dropped because the channel does not exist yet. Both calls must be in `index.js` to run unconditionally at startup.

**Files:**

- Create: `lib/notification-setup.ts`
- Modify: `index.js`
- Modify: `hooks/use-firebase-token.ts`

- [ ] **Step 1: Create lib/notification-setup.ts**

```ts
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

// Foreground: suppress OS banner/sound — app handles via onMessage toast + sound.
// Background: OS handles automatically (this handler only applies in foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
})

// Android: create channel at startup (unconditional) so background notifications
// that arrive before the user logs in are not silently dropped for missing channel.
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

- [ ] **Step 2: Add notification-setup import to index.js**

Current `index.js`:

```js
/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. firebase-background-handler — trước khi React start, để setBackgroundMessageHandler
 *    được đăng ký cho killed/background state
 * 2. navigation-setup: enableScreens(true) + enableFreeze(true) — trước khi bất kỳ Screen nào render
 * 3. expo-router/entry — registerComponent + mount app
 */
import './lib/firebase-background-handler'
import './lib/navigation-setup'
import 'expo-router/entry'
```

Replace with:

```js
/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. firebase-background-handler — setBackgroundMessageHandler trước khi React start
 * 2. notification-setup — setNotificationHandler + Android channel trước khi React start
 * 3. navigation-setup: enableScreens(true) + enableFreeze(true) — trước khi bất kỳ Screen nào render
 * 4. expo-router/entry — registerComponent + mount app
 */
import './lib/firebase-background-handler'
import './lib/notification-setup'
import './lib/navigation-setup'
import 'expo-router/entry'
```

- [ ] **Step 3: Remove setNotificationHandler block from use-firebase-token.ts**

Open `hooks/use-firebase-token.ts`. Delete the entire block at lines 19–27:

```ts
// Foreground: suppress OS notification — app handles via toast + sound instead.
// Background: OS handles automatically (this handler only applies when app is in foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
})
```

- [ ] **Step 4: Clean up the Android block and all console.log statements in use-firebase-token.ts**

After removing the `setNotificationHandler` block, the `requestPermissionAndGetToken` function has:

- `setNotificationChannelAsync` call inside the Android block — remove it (keep only `requestPermissionsAsync`)
- 5 `console.log` / `console.warn` statements — remove all of them along with their `// eslint-disable-next-line no-console` lines

The final `requestPermissionAndGetToken` function should look exactly like this:

```ts
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
    } catch {
      // APNs registration failure is non-fatal — token fetch will fail if needed
    }
  }

  // Get FCM token — retry up to 5x with backoff (APNs token may arrive async on iOS)
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

Also update the file-level doc comment at the top to remove the stale note about `setNotificationHandler`:

```ts
/**
 * useFirebaseToken — request notification permission + get FCM device token.
 *
 * - Only runs on physical device (simulator returns null)
 * - iOS: uses @react-native-firebase/messaging to get FCM token (not raw APNs token)
 * - Android: same Firebase SDK, already worked before
 * - Returns { token, permissionDenied } for upstream consumers
 */
```

- [ ] **Step 5: Verify typecheck passes**

```bash
npm run check
```

Expected: exits 0, no TypeScript or ESLint errors.

- [ ] **Step 6: Commit**

```bash
git add lib/notification-setup.ts index.js hooks/use-firebase-token.ts
git commit -m "fix(notification): move notification setup to entry point

setNotificationHandler and setNotificationChannelAsync must run at startup
before React mounts, not inside a hook gated on auth. Extracted to
lib/notification-setup.ts imported first in index.js. Also removed debug
console.log statements from use-firebase-token.ts."
```

---

### Task 3: Remove hardcoded aps-environment from entitlements

**Why:** `aps-environment: development` is hardcoded in `ios/TRENDCoffee/TRENDCoffee.entitlements`. This forces all builds — including production App Store builds — to use the APNs sandbox endpoint. Production devices (distributed via App Store / TestFlight external) receive tokens bound to the production APNs endpoint but the app contacts the sandbox, so push notifications are silently dropped. Xcode manages this value automatically per build configuration (Debug → development, Release → production) when the key is absent.

**Files:**

- Modify: `ios/TRENDCoffee/TRENDCoffee.entitlements`

- [ ] **Step 1: Remove aps-environment from the entitlements file**

Current `ios/TRENDCoffee/TRENDCoffee.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>aps-environment</key>
    <string>development</string>
  </dict>
</plist>
```

Replace with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
  </dict>
</plist>
```

- [ ] **Step 2: Verify the file no longer contains aps-environment**

```bash
grep -c "aps-environment" ios/TRENDCoffee/TRENDCoffee.entitlements
```

Expected output: `0`

- [ ] **Step 3: Commit**

```bash
git add ios/TRENDCoffee/TRENDCoffee.entitlements
git commit -m "fix(notification): remove hardcoded aps-environment from entitlements

Hardcoding development forces all builds to use APNs sandbox, silently
dropping notifications on production/TestFlight builds. Let Xcode assign
the correct environment per build configuration."
```

---

### Task 4: Remove debug console.log from firebase-background-handler.ts and fcm-token-registration.ts

**Why:** The pre-commit hook blocks commits containing `console.log` in TS/TSX files. These debug statements were added during debugging and must be removed.

**Files:**

- Modify: `lib/firebase-background-handler.ts`
- Modify: `lib/fcm-token-registration.ts`

- [ ] **Step 1: Clean lib/firebase-background-handler.ts**

Current content:

```ts
import messaging from '@react-native-firebase/messaging'

// Must be registered at module level outside React for background/killed state.
// Firebase displays the notification automatically (notification field in payload).
// This handler keeps the background task alive so the delivery completes.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // eslint-disable-next-line no-console
  console.log('[FCM BG] received:', JSON.stringify(remoteMessage))
})
```

Replace with:

```ts
import messaging from '@react-native-firebase/messaging'

// Must be registered at module level outside React for background/killed state.
// Firebase displays the notification automatically (notification field in payload).
// This handler keeps the background task alive so the delivery completes.
messaging().setBackgroundMessageHandler(async () => {})
```

- [ ] **Step 2: Remove the 3 debug console statements from lib/fcm-token-registration.ts**

Open `lib/fcm-token-registration.ts`. Remove lines 51–52 (before the retry loop):

```ts
// eslint-disable-next-line no-console
console.log('[FCM] Registering token with server:', { token, platform })
```

Remove lines 57–58 (inside the try block on success):

```ts
// eslint-disable-next-line no-console
console.log('[FCM] Token registered successfully')
```

Remove lines 63–64 (inside the catch block):

```ts
// eslint-disable-next-line no-console
console.error('[FCM] Registration error (attempt', attempt, '):', error)
```

The resulting `registerTokenWithRetry` function body should look exactly like:

```ts
export async function registerTokenWithRetry(
  token: string,
): Promise<RegistrationResult> {
  const platform = getPlatform()
  const userAgent = `${Platform.OS}/${Platform.Version}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await registerDeviceToken({ token, platform, userAgent })
      return { success: true }
    } catch (error) {
      const isLast = attempt === MAX_RETRIES
      const isRetryable = isRetryableError(error)

      if (isLast || !isRetryable) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
      const backoffMs = BACKOFF_DELAYS[attempt] ?? 15000
      await delay(backoffMs)
    }
  }
  return { success: false, error: 'Max retries exceeded' }
}
```

- [ ] **Step 3: Run quality check**

```bash
npm run check
```

Expected: exits 0. No `console.log` in any committed TS file.

- [ ] **Step 4: Commit**

```bash
git add lib/firebase-background-handler.ts lib/fcm-token-registration.ts
git commit -m "chore(notification): remove debug console.log from FCM files"
```

---

## Manual Verification Checklist

After all tasks are committed, rebuild and test on physical devices.

**Required rebuilds (config changes require native rebuild):**

- `npx expo run:ios --device` — app.json UIBackgroundModes + firebase.json require regenerating Info.plist
- `npx expo run:android` — notification-setup.ts channel creation change

**Android verification:**

- [ ] Fresh install on Android 13+ device
- [ ] On first launch: OS permission dialog appears asking for notification access
- [ ] Send test notification from Firebase Console → Messaging → Send test message (app in background)
- [ ] OS notification appears in system tray
- [ ] Open app and send another test — toast + custom sound plays, only ONE toast (not two)
- [ ] No unrelated regressions

**iOS verification (physical device, development build):**

- [ ] Fresh install on iOS device via `npx expo run:ios --device`
- [ ] On first launch: permission dialog appears
- [ ] Send test notification while app is in foreground — toast + custom sound plays (OS banner should NOT appear — we handle it ourselves)
- [ ] Send test notification while app is in background — OS notification banner appears in notification center
- [ ] Send test notification while app is killed — OS notification appears after a few seconds
- [ ] Check Xcode console to confirm `[FCM iOS] registerDeviceForRemoteMessages` log is gone (cleanup worked)
