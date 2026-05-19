# Order Ready Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When FCM delivers `data.message = 'order-needs-ready-to-get'`, show a full-screen modal with looping sound and continuous vibration while the app is open; use a dedicated high-prominence Android notification channel with long vibration for background/killed state.

**Architecture:** A new `useOrderReadyAlert` hook owns visibility state and exposes `show/hide`; `OrderReadyAlertModal` owns all audio/vibration side effects scoped to its `isVisible` prop; `useNotificationListener` detects the message code and calls `show()` instead of the regular toast path; `NotificationProvider` wires them together and mounts the modal.

**Tech Stack:** React Native (Modal, Vibration), expo-av (Audio.Sound), expo-notifications (channel), @react-native-firebase/messaging, TypeScript strict, lucide-react-native

---

## File Map

| File | Change |
|------|--------|
| `assets/sound/order_ready.mp3` | Create: placeholder sound (copy of notification.mp3 — replace with real 15s file later) |
| `android/app/src/main/res/raw/order_ready.mp3` | Create: same file for Android channel |
| `app.json` | Modify: add `order_ready.mp3` to `expo-notifications.sounds` array |
| `lib/notification-setup.ts` | Modify: add `order-ready` channel creation for Android |
| `hooks/use-order-ready-alert.ts` | Create: visibility + message state hook |
| `components/notification/order-ready-alert-modal.tsx` | Create: full-screen modal with loop sound + continuous vibration |
| `providers/notification-provider.tsx` | Modify: call `useOrderReadyAlert`, pass `show` to listener, mount modal |
| `hooks/use-notification-listener.ts` | Modify: detect `ORDER_NEEDS_READY_TO_GET`, call `onOrderReady` instead of toast |

---

### Task 1: Add placeholder sound file and register it in app.json

**Files:**
- Create: `assets/sound/order_ready.mp3`
- Create: `android/app/src/main/res/raw/order_ready.mp3`
- Modify: `app.json:95-97`

Context: The real 15-second sound file will be provided later. For now, copy the existing `notification.mp3` under the new name so all code compiles and the channel can reference it. The Android `res/raw/` copy is needed so the channel can play sound in the background without going through Expo's asset bundler.

- [ ] **Step 1: Copy placeholder sound**

```bash
cp assets/sound/notification.mp3 assets/sound/order_ready.mp3
cp android/app/src/main/res/raw/notification.mp3 android/app/src/main/res/raw/order_ready.mp3
```

- [ ] **Step 2: Register in app.json**

In `app.json`, find the `expo-notifications` plugin config (around line 91-100). The current `sounds` array is:
```json
"sounds": [
  "./assets/sound/notification.mp3"
]
```

Replace with:
```json
"sounds": [
  "./assets/sound/notification.mp3",
  "./assets/sound/order_ready.mp3"
]
```

- [ ] **Step 3: Commit**

```bash
git add assets/sound/order_ready.mp3 android/app/src/main/res/raw/order_ready.mp3 app.json
git commit -m "feat(order-alert): add order_ready sound placeholder + app.json registration"
```

---

### Task 2: Create `order-ready` Android notification channel

**Files:**
- Modify: `lib/notification-setup.ts`

Context: This channel is used by Firebase when the app is in background/killed state. Android channel properties (vibrationPattern, sound, importance) are **locked after first creation** on a device — this is a new `channelId` so creation is safe. The `vibrationPattern` array alternates [delay, vibrate, pause, vibrate, ...] in milliseconds. The `sound` value is the filename without extension, matching `android/app/src/main/res/raw/order_ready.mp3`.

- [ ] **Step 1: Add channel creation to `lib/notification-setup.ts`**

Current file ends after the `default` channel block. Append a second `setNotificationChannelAsync` call inside the same `if (Platform.OS === 'android')` block:

```typescript
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
})

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7A737',
    sound: 'notification.mp3',
  }).catch((e) =>
    // eslint-disable-next-line no-console
    console.error(
      '[Notifications] Failed to create Android default channel:',
      e,
    ),
  )

  Notifications.setNotificationChannelAsync('order-ready', {
    name: 'Thông báo lấy đơn',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000, 500, 1000, 500, 1000],
    lightColor: '#F7A737',
    sound: 'order_ready',
  }).catch((e) =>
    // eslint-disable-next-line no-console
    console.error(
      '[Notifications] Failed to create Android order-ready channel:',
      e,
    ),
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0, no errors in `lib/notification-setup.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/notification-setup.ts
git commit -m "feat(order-alert): add order-ready Android notification channel"
```

---

### Task 3: Create `useOrderReadyAlert` hook

**Files:**
- Create: `hooks/use-order-ready-alert.ts`

Context: This hook owns the alert's visibility state and the message text. It is called once in `NotificationProvider` and exposes `show(title, body)` and `hide()`. The `show` function is passed as a callback to `useNotificationListener`.

- [ ] **Step 1: Create `hooks/use-order-ready-alert.ts`**

```typescript
import { useCallback, useState } from 'react'

interface OrderReadyAlertState {
  isVisible: boolean
  title: string
  body: string
}

const HIDDEN: OrderReadyAlertState = { isVisible: false, title: '', body: '' }

export function useOrderReadyAlert() {
  const [state, setState] = useState<OrderReadyAlertState>(HIDDEN)

  const show = useCallback((title: string, body: string) => {
    setState({ isVisible: true, title, body })
  }, [])

  const hide = useCallback(() => {
    setState(HIDDEN)
  }, [])

  return { ...state, show, hide }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-order-ready-alert.ts
git commit -m "feat(order-alert): add useOrderReadyAlert hook"
```

---

### Task 4: Create `OrderReadyAlertModal` component

**Files:**
- Create: `components/notification/order-ready-alert-modal.tsx`

Context: This component is responsible for all audio and vibration side effects. It uses a `useEffect` keyed on `isVisible` — when `isVisible` becomes `true`, it starts the sound loop and vibration; the cleanup function stops both. A `useRef` for the `onDismiss` callback prevents the effect from restarting when the parent re-renders. `Audio.Sound.createAsync` with `{ isLooping: true }` handles the loop on both iOS and Android. `Vibration.vibrate(pattern, true)` repeats the pattern on both platforms. Auto-dismiss fires after 60 seconds via `setTimeout`.

- [ ] **Step 1: Create `components/notification/order-ready-alert-modal.tsx`**

```typescript
import { Audio, type AVPlaybackSource } from 'expo-av'
import { BellRing } from 'lucide-react-native'
import { memo, useEffect, useRef } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  useColorScheme,
} from 'react-native'

import { colors } from '@/constants'

interface Props {
  isVisible: boolean
  title: string
  body: string
  onDismiss: () => void
}

const VIBRATION_PATTERN = [0, 1000, 500, 1000, 500, 1000, 500, 1000]
const AUTO_DISMISS_MS = 60_000

export const OrderReadyAlertModal = memo(function OrderReadyAlertModal({
  isVisible,
  title,
  body,
  onDismiss,
}: Props) {
  const isDark = useColorScheme() === 'dark'
  const soundRef = useRef<Audio.Sound | null>(null)
  // Stable ref so the effect does not restart when onDismiss identity changes
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!isVisible) return

    Vibration.vibrate(VIBRATION_PATTERN, true)

    let mounted = true
    Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/assets/sound/order_ready.mp3') as AVPlaybackSource,
      { isLooping: true, volume: 1.0 },
    )
      .then(({ sound }) => {
        if (!mounted) {
          void sound.unloadAsync()
          return
        }
        soundRef.current = sound
        void sound.playAsync()
      })
      .catch(() => {})

    const timer = setTimeout(() => {
      onDismissRef.current()
    }, AUTO_DISMISS_MS)

    return () => {
      mounted = false
      clearTimeout(timer)
      Vibration.cancel()
      const s = soundRef.current
      soundRef.current = null
      if (s) {
        void s.stopAsync().catch(() => {})
        void s.unloadAsync().catch(() => {})
      }
    }
  }, [isVisible])

  if (!isVisible) return null

  const overlayBg = isDark ? 'rgba(0,0,0,0.93)' : 'rgba(15,15,15,0.88)'
  const titleColor = colors.white.light
  const bodyColor = colors.gray[300]

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[s.overlay, { backgroundColor: overlayBg }]}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <BellRing size={48} color="#F7A737" strokeWidth={1.5} />
          </View>
          <Text style={[s.title, { color: titleColor }]}>{title}</Text>
          {!!body && (
            <Text style={[s.body, { color: bodyColor }]}>{body}</Text>
          )}
        </View>

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Đã lấy đơn"
          style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
        >
          <Text style={s.btnText}>Đã lấy đơn</Text>
        </Pressable>
      </View>
    </Modal>
  )
})

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(247,167,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'BeVietnamPro_600SemiBold',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: '#F7A737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#ffffff',
  },
})
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/notification/order-ready-alert-modal.tsx
git commit -m "feat(order-alert): add OrderReadyAlertModal full-screen component"
```

---

### Task 5: Wire `OrderReadyAlertModal` into `NotificationProvider`

**Files:**
- Modify: `providers/notification-provider.tsx`

Context: `useOrderReadyAlert` is called here; `show` is passed as a new optional `onOrderReady` prop to `useNotificationListener`; the modal is rendered in the JSX return. The `hide` function is wrapped in `useCallback` before being passed as `onDismiss` to keep the modal's ref stable.

- [ ] **Step 1: Update `providers/notification-provider.tsx`**

Replace the full file with:

```typescript
/**
 * NotificationProvider — orchestrates all notification hooks.
 *
 * Responsibilities:
 * 1. Register FCM token when authenticated (T2+T3)
 * 2. Start token refresh scheduler (T4)
 * 3. Listen foreground notifications → toast + sound (T5)
 * 4. Handle background tap → navigate (T7+T8)
 * 5. Show permission dialog when denied (T12)
 * 6. Show order-ready full-screen alert when order is ready for pickup
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { OrderReadyAlertModal } from '@/components/notification/order-ready-alert-modal'
import { NotificationPermissionSheet } from '@/components/notification/notification-permission-sheet'
import { useOrderReadyAlert } from '@/hooks/use-order-ready-alert'
import { useRegisterDeviceToken } from '@/hooks/use-register-device-token'
import { useNotificationListener } from '@/hooks/use-notification-listener'
import { useNotificationResponse } from '@/hooks/use-notification-response'
import {
  startTokenRefreshScheduler,
  stopTokenRefreshScheduler,
} from '@/lib/fcm-token-manager'
import { useAuthStore } from '@/stores'

export function NotificationProvider() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const schedulerStartedRef = useRef(false)

  // Order-ready full-screen alert
  const { isVisible, title, body, show: showOrderReady, hide: hideOrderReady } =
    useOrderReadyAlert()

  // T2+T3: Get FCM token + register with server (only when authenticated)
  const { permissionDenied } = useRegisterDeviceToken(isAuthenticated)

  // T5: Foreground listener — only when authenticated so foreground FCM
  // notifications are never added to the store while no user is logged in.
  useNotificationListener(isAuthenticated, showOrderReady)

  // T7+T8: Background tap + cold start — gated on auth so cold-start taps
  // from a previous user's session are not processed under the new user.
  // The effect re-runs when isAuthenticated becomes true, so
  // getLastNotificationResponseAsync() is still called after login.
  useNotificationResponse(isAuthenticated)

  // T4: Token refresh scheduler
  useEffect(() => {
    if (isAuthenticated && !schedulerStartedRef.current) {
      startTokenRefreshScheduler()
      schedulerStartedRef.current = true
    } else if (!isAuthenticated && schedulerStartedRef.current) {
      stopTokenRefreshScheduler()
      schedulerStartedRef.current = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    return () => {
      stopTokenRefreshScheduler()
    }
  }, [])

  // T12: Permission dialog — show once per session when denied
  const [showPermissionSheet, setShowPermissionSheet] = useState(false)
  const hasShownRef = useRef(false)

  useEffect(() => {
    if (permissionDenied && isAuthenticated && !hasShownRef.current) {
      // Delay to avoid showing during app mount animation
      const timer = setTimeout(() => {
        setShowPermissionSheet(true)
        hasShownRef.current = true
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [permissionDenied, isAuthenticated])

  const handleClosePermission = useCallback(() => {
    setShowPermissionSheet(false)
  }, [])

  return (
    <>
      <OrderReadyAlertModal
        isVisible={isVisible}
        title={title}
        body={body}
        onDismiss={hideOrderReady}
      />
      <NotificationPermissionSheet
        visible={showPermissionSheet}
        onClose={handleClosePermission}
      />
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0. Specifically verify that `showOrderReady` satisfies `(title: string, body: string) => void`.

- [ ] **Step 3: Commit**

```bash
git add providers/notification-provider.tsx
git commit -m "feat(order-alert): mount OrderReadyAlertModal in NotificationProvider"
```

---

### Task 6: Detect `ORDER_NEEDS_READY_TO_GET` in `useNotificationListener`

**Files:**
- Modify: `hooks/use-notification-listener.ts`

Context: The listener currently treats every message the same (store + toast + sound). For `ORDER_NEEDS_READY_TO_GET`, we still add to the notification store (so it appears in notification history), but skip the regular toast and regular sound — instead calling `onOrderReady(title, body)` which triggers the full-screen modal. The new optional `onOrderReady` parameter defaults to `undefined` so all existing call sites stay valid.

- [ ] **Step 1: Update `hooks/use-notification-listener.ts`**

Replace the full file with:

```typescript
/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - For ORDER_NEEDS_READY_TO_GET: calls onOrderReady (full-screen alert) instead
 *   of regular toast + sound
 * - For all other codes: shows toast + plays notification.mp3
 *
 * Cleanup:
 * - Single in-flight loadPromise prevents 2× createAsync when notifications
 *   arrive in parallel (otherwise the first Sound instance leaks).
 * - disposeSound() is called in the effect cleanup so the cached Audio.Sound
 *   does not survive logout / unmount.
 */
import { Audio, type AVPlaybackSource } from 'expo-av'
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { NotificationMessageCode } from '@/constants/notification.constant'
import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToastInternal } from '@/providers/toast-provider'

const SOUND_VOLUME = 0.5

// Preloaded sound instance — reuse across notifications, avoid re-loading file
let cachedSound: Audio.Sound | null = null
let loadPromise: Promise<Audio.Sound> | null = null

async function getSound(): Promise<Audio.Sound> {
  if (cachedSound) return cachedSound
  if (!loadPromise) {
    loadPromise = Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/assets/sound/notification.mp3') as AVPlaybackSource,
    )
      .then(({ sound }) => {
        cachedSound = sound
        return sound
      })
      .finally(() => {
        loadPromise = null
      })
  }
  return loadPromise
}

async function disposeSound(): Promise<void> {
  const s = cachedSound
  cachedSound = null
  if (s) {
    await s.unloadAsync().catch(() => {})
  }
}

async function playNotificationSound(): Promise<void> {
  try {
    const sound = await getSound()
    await sound.setPositionAsync(0)
    await sound.setVolumeAsync(SOUND_VOLUME)
    await sound.playAsync()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound playback failed:', e)
    // Unload to keep the native Audio engine clean before we lose the ref
    await disposeSound()
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

export function useNotificationListener(
  enabled = true,
  onOrderReady?: (title: string, body: string) => void,
) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const code = remoteMessage.data?.message as string | undefined

      if (code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET) {
        // Full-screen modal handles alert — skip regular toast + sound
        const alertTitle =
          remoteMessage.notification?.title ?? 'Đơn của bạn đã sẵn sàng'
        const alertBody = remoteMessage.notification?.body ?? ''
        onOrderReady?.(alertTitle, alertBody)
        return
      }

      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) showToastInternal(title, body, 'info')

      playNotificationSound().catch(() => {})
    })

    return () => {
      unsubscribe()
      void disposeSound()
    }
  }, [enabled, onOrderReady])
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0. Verify `onOrderReady` is typed as `((title: string, body: string) => void) | undefined`.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-notification-listener.ts
git commit -m "feat(order-alert): detect ORDER_NEEDS_READY_TO_GET, trigger full-screen alert"
```

---

### Task 7: Manual verification checklist

**Files:** none (manual testing step)

- [ ] **Step 1: Start dev server**

```bash
npx expo start
```

- [ ] **Step 2: Test foreground alert**
  - Login → stay on any tab
  - Trigger an `order-needs-ready-to-get` FCM message (via Firebase Console or backend)
  - Expected: full-screen dark overlay appears with bell icon, title, body, "Đã lấy đơn" button
  - Expected: device vibrates continuously, sound loops
  - Tap "Đã lấy đơn" → modal closes, vibration stops, sound stops ✅
  - Wait 60 seconds without tapping → modal auto-closes ✅

- [ ] **Step 3: Test foreground — other notification codes unchanged**
  - Trigger any other FCM code (e.g. `order-paid`)
  - Expected: regular toast + short sound, NO full-screen modal ✅

- [ ] **Step 4: Test background (Android)**
  - Background the app, trigger `order-needs-ready-to-get`
  - Expected: heads-up banner at top of screen, ~4s vibration, `order_ready.mp3` plays (1× — same as notification.mp3 placeholder for now) ✅
  - Tap banner → app opens (does NOT show full-screen modal — modal is foreground-only) ✅

- [ ] **Step 5: Verify no global toast fires for order-ready when foreground**
  - Only the full-screen modal should appear, no toast ✅

- [ ] **Step 6: Note for later**
  - Replace `assets/sound/order_ready.mp3` and `android/app/src/main/res/raw/order_ready.mp3` with the real ~15-second sound file when it is available
  - BE must send `android.notification.channelId = 'order-ready'` for `order-needs-ready-to-get` FCM payloads (see design spec BE integration checklist)
