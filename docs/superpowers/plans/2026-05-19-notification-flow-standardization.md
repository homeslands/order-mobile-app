# Notification Flow Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the notification flow so that foreground / background / cold-start taps all behave consistently, the FCM background handler is no longer dead code, dedup is reliable, and audio / channels never race startup.

**Architecture:** BE sends an FCM **notification message** (has `notification` field) with a stringified `data.payload` JSON. Firebase Cloud Messaging SDK renders the system tray notification natively. The app only needs to:

- React to **foreground** messages via `onMessage` (toast + sound + ORDER_READY modal).
- React to **tap** via `getInitialNotification` (cold start), `onNotificationOpenedApp` (background tap), and the expo-notifications response listener (in-app local notifications). The native background message handler is a no-op anti-warning stub.

**Tech Stack:** React Native 0.81 + Expo 54, `@react-native-firebase/messaging`, `expo-notifications`, `expo-av`, Zustand, expo-router, TypeScript strict, NativeWind.

---

## File Structure

```
index.js                                            (modify)
lib/
  notification-setup.ts                             (modify — channel readiness gate, audio preload)
  firebase-background-handler.ts                    (modify — dummy anti-warning stub)
  notification-navigation.ts                        (modify — split cold-start vs background-tap)
hooks/
  use-notification-listener.ts                      (modify — remove sound dispose race, share sound module)
  use-notification-response.ts                      (modify — module-level dedup, unified ID, launch timestamp guard, order-ready bridge)
  use-order-ready-alert.ts                          (modify — auto mark-as-read on show)
providers/
  notification-provider.tsx                         (modify — pass showOrderReady to useNotificationResponse)
lib/
  notification-sound.ts                             (new — shared audio cache + preload)
  app-launch-time.ts                                (new — captured at module load)
```

---

## File: lib/app-launch-time.ts (new)

A single source of truth for "when this JS bundle started running". Used by the iOS ghost-response guard to discard `getLastNotificationResponseAsync()` results from a previous session.

---

## File: lib/notification-sound.ts (new)

A shared cache for the foreground notification sound. Two reasons for extracting it from `use-notification-listener.ts`:

1. `notification-setup.ts` can preload it at app start (eliminate first-shot 100-300ms load delay).
2. We can stop unloading the cached `Audio.Sound` in the listener's effect cleanup (race condition fix).

---

## Task 1: Capture app launch time

**Why:** iOS `getLastNotificationResponseAsync()` returns the **most recent** response, including one from a previous app session (the OS keeps it cached). If the user opened the app via icon (not the notification), we currently navigate as if they tapped the notification — a "ghost response". We discriminate by comparing the response's notification date against the JS bundle start time.

**Files:**

- Create: `lib/app-launch-time.ts`

- [ ] **Step 1: Create launch time module**

```ts
// lib/app-launch-time.ts
/**
 * Captured at JS bundle load — used to discard notification responses that
 * belong to a previous app session (iOS getLastNotificationResponseAsync
 * returns the OS-cached response across sessions, causing "ghost" taps).
 */
export const APP_LAUNCH_TIME_MS = Date.now()

/** Margin to absorb FCM delivery + native -> JS bridge latency on cold start. */
export const COLD_START_RESPONSE_WINDOW_MS = 30_000

/**
 * Returns true if a notification response with `notificationDateMs` is recent
 * enough relative to this app's launch to be considered a real cold-start tap
 * (not a ghost response from a previous session).
 */
export function isResponseFromThisSession(
  notificationDateMs: number | undefined,
): boolean {
  if (notificationDateMs === undefined) return false
  // Accept if the notification was delivered up to COLD_START_RESPONSE_WINDOW_MS
  // *before* the JS bundle started — covers the gap between OS delivering the
  // tap and React/JS being ready to consume it.
  return (
    notificationDateMs >= APP_LAUNCH_TIME_MS - COLD_START_RESPONSE_WINDOW_MS
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/app-launch-time.ts
git commit -m "feat(notification): add app launch time module for ghost-response guard"
```

---

## Task 2: Extract shared notification sound module

**Why:** The cached `Audio.Sound` currently lives inside `use-notification-listener.ts`. When that hook's effect cleans up (e.g., `enabled` flips to `false` on logout), we call `disposeSound()` which `unloadAsync()`s the same instance that may have an in-flight `playAsync()` from a notification fired milliseconds earlier — race condition. Also we cannot preload the file until the hook mounts, causing first-shot lag.

By moving the cache to a module-level singleton with proper reference-counting around playback, we can:

- Preload from `notification-setup.ts` at startup.
- Stop unloading on effect cleanup (the sound is process-scoped, not auth-scoped).
- Still expose a `disposeNotificationSound()` for explicit teardown if ever needed.

**Files:**

- Create: `lib/notification-sound.ts`

- [ ] **Step 1: Create shared sound module**

```ts
// lib/notification-sound.ts
/**
 * Shared cache for the foreground notification sound (notification.mp3).
 *
 * Design:
 * - Singleton Audio.Sound instance — created once, reused for every shot.
 * - In-flight playback counter prevents unloadAsync() during playAsync().
 * - preloadNotificationSound() can be called at app startup to eliminate
 *   first-shot load latency (100-300ms on cold start).
 * - disposeNotificationSound() waits for active playbacks to finish before
 *   unloading, so logout / unmount never races a sound shot.
 */
import { Audio, type AVPlaybackSource } from 'expo-av'

const SOUND_VOLUME = 0.5

let cachedSound: Audio.Sound | null = null
let loadPromise: Promise<Audio.Sound> | null = null
let activePlaybacks = 0
let pendingDispose = false

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

/** Fire-and-forget preload — call once at app startup. */
export function preloadNotificationSound(): void {
  getSound().catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound preload failed:', e)
  })
}

export async function playNotificationSound(): Promise<void> {
  // Refuse to play during teardown — otherwise we might increment the counter
  // *after* dispose started waiting, blocking shutdown.
  if (pendingDispose) return
  activePlaybacks++
  try {
    const sound = await getSound()
    await sound.setPositionAsync(0)
    await sound.setVolumeAsync(SOUND_VOLUME)
    await sound.playAsync()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound playback failed:', e)
  } finally {
    activePlaybacks--
  }
}

/**
 * Unload the cached sound. Waits up to 1500ms for in-flight playbacks to
 * finish so we never unload while playAsync() is mid-flight. Caller should
 * await this if it cares about completion (logout flow).
 */
export async function disposeNotificationSound(): Promise<void> {
  pendingDispose = true
  const deadline = Date.now() + 1500
  while (activePlaybacks > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50))
  }
  const s = cachedSound
  cachedSound = null
  pendingDispose = false
  if (s) await s.unloadAsync().catch(() => {})
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/notification-sound.ts
git commit -m "feat(notification): extract shared notification sound module with race-safe dispose"
```

---

## Task 3: Add channel readiness gate + preload sound in notification-setup

**Why:**

- Channel `setNotificationChannelAsync` is `fire-and-forget` — if the OS has just installed the app and the user is logging in within the first second, `useRegisterDeviceToken` may register the FCM token before the channels exist. Notifications can then arrive on a missing channel (Android silently drops them or uses fallback importance).
- The first call to load `notification.mp3` happens lazily when the first foreground push arrives, adding 100-300ms latency to the first shot. We can preload during the same idle window that runs other startup code.

We expose `awaitChannelsReady()` so the token-registration hook can `await` it once before the FCM API call.

**Files:**

- Modify: `lib/notification-setup.ts`

- [ ] **Step 1: Replace `lib/notification-setup.ts` content**

```ts
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

import { preloadNotificationSound } from '@/lib/notification-sound'

// Foreground: suppress OS banner/sound — app handles via onMessage toast + sound.
// Background: OS handles automatically (this handler only applies in foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
})

// Channel creation is fire-and-forget on Android but downstream code (FCM token
// registration) must NOT race ahead — expose a single Promise the rest of the
// app can await once before registering for push. On iOS the Promise resolves
// immediately because channels are an Android-only concept.
let _channelsReady: Promise<void> | null = null

function createChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve()

  return Promise.allSettled([
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F7A737',
      sound: 'notification.mp3',
    }),
    Notifications.setNotificationChannelAsync('order-needs-ready-to-get', {
      name: 'Thông báo lấy đơn',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [
        0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500,
        1000, 500, 1000, 500, 1000, 500, 1000,
      ],
      lightColor: '#F7A737',
      sound: 'order_ready',
    }),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.error('[Notifications] Channel setup failed:', r.reason)
      }
    }
  })
}

export function awaitChannelsReady(): Promise<void> {
  if (!_channelsReady) _channelsReady = createChannels()
  return _channelsReady
}

// Kick off channel creation eagerly at module load so the Promise is already
// (likely) resolved by the time auth rehydrates.
void awaitChannelsReady()

// Preload notification.mp3 so the first foreground shot has zero load latency.
preloadNotificationSound()
```

- [ ] **Step 2: Gate FCM token registration on channel readiness**

We add a single `await awaitChannelsReady()` inside `use-register-device-token.ts`. Find the hook (it's the only consumer that registers the token with the server) and add the gate before requesting the token. Open `hooks/use-register-device-token.ts` and locate the function that runs `messaging().getToken()` or the equivalent. Add the import + await:

```ts
// hooks/use-register-device-token.ts (additions)
import { awaitChannelsReady } from '@/lib/notification-setup'

// Inside the effect that requests the token (somewhere near the top, before
// messaging().getToken() / requestPermission()):
await awaitChannelsReady()
```

If the hook's structure does not allow an inline `await` (e.g., it returns a sync callback), wrap the existing async function so it awaits channel readiness as its first step. The exact insertion point: immediately before the FCM permission / token call sequence — channel readiness is a precondition for receiving notifications, not for permission UX, so it can also be moved earlier if simpler.

- [ ] **Step 3: Commit**

```bash
git add lib/notification-setup.ts hooks/use-register-device-token.ts
git commit -m "feat(notification): gate FCM token registration on Android channel readiness + preload notification sound"
```

---

## Task 4: Convert firebase-background-handler to dummy anti-warning stub

**Why:** BE sends FCM **notification messages** (with `notification` field). When that field is present, the FCM SDK renders the system tray notification natively on both platforms — our `scheduleLocalNotification` early-returns and does nothing. The handler is dead code, but **must still be registered** otherwise `@react-native-firebase/messaging` logs a warning every time a background message is delivered:

> No background message handler has been set. Set a handler via the `setBackgroundMessageHandler()` method.

So we keep registration, drop all logic, and document that this is by design.

**Files:**

- Modify: `lib/firebase-background-handler.ts`

- [ ] **Step 1: Replace file with dummy handler**

```ts
/**
 * Firebase background message handler — DUMMY anti-warning stub.
 *
 * Why dummy: BE sends FCM `notification messages` (payload contains a
 * `notification` field). When that field is present, the FCM SDK renders the
 * system tray notification natively on both iOS and Android. The JS handler
 * would only run for `data-only` messages, which we never send.
 *
 * Why we keep registering: @react-native-firebase/messaging emits a warning on
 * every background delivery if no handler is set. Registering an empty handler
 * silences that warning without altering behavior.
 *
 * Flow (current production):
 *   - Background / killed: FCM SDK renders tray notification → user taps →
 *     onNotificationOpenedApp / getInitialNotification handles navigation.
 *   - Foreground: onMessage handles via use-notification-listener.
 *
 * Tap handling lives in hooks/use-notification-response.ts.
 */
import messaging from '@react-native-firebase/messaging'

messaging().setBackgroundMessageHandler(async () => {
  // Intentionally empty — FCM renders the notification natively because the
  // BE payload includes a `notification` field. See file-level comment.
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/firebase-background-handler.ts
git commit -m "refactor(notification): convert background handler to dummy anti-warning stub"
```

---

## Task 5: Split cold-start vs background-tap navigation modes

**Why:** `navigateFromNotification` currently applies a 600ms delay to **every** invocation. That delay exists so cold start has enough time for JS bundle load + React mount + `NavigationEngineProvider` to come up. For a **background tap** (app is already alive in memory), the delay is pure user-perceived lag. Splitting the path lets us push immediately when the app is warm.

**Files:**

- Modify: `lib/notification-navigation.ts`

- [ ] **Step 1: Replace `lib/notification-navigation.ts` content**

```ts
/**
 * Notification Navigation — map notification data → app route.
 *
 * Two entry modes:
 * - 'cold-start':     app was killed; JS just booted. Defer ~600ms + retry.
 * - 'background-tap': app was already running. Push immediately (retry once
 *                     if navigation engine is briefly locked).
 *
 * Used by:
 * - Background tap handler (user taps system notification, app warm)
 * - Cold start handler (app opened via notification tap, app killed)
 * - Notification list (user taps item in list — background-tap mode)
 */
import { NotificationMessageCode } from '@/constants'
import { isNavigationLocked, navigateNative } from '@/lib/navigation'

export type NotificationNavMode = 'cold-start' | 'background-tap'

interface NotificationRouteData {
  message?: string
  order?: string
  cardOrderSlug?: string
  [key: string]: string | undefined
}

function parseNotificationData(
  data: Record<string, string> | undefined,
): NotificationRouteData {
  if (!data) return {}

  // Backend may send metadata as JSON string in data.payload
  let parsed: Record<string, string> = {}
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

  return { ...data, ...parsed }
}

export function getRouteForMessage(
  routeData: NotificationRouteData,
): string | null {
  const { message, order } = routeData

  switch (message) {
    case NotificationMessageCode.ORDER_NEEDS_READY_TO_GET:
    case NotificationMessageCode.ORDER_NEEDS_PROCESSED:
    case NotificationMessageCode.ORDER_NEEDS_DELIVERED:
    case NotificationMessageCode.ORDER_NEEDS_CANCELLED:
    case NotificationMessageCode.ORDER_PAID:
      return order ? `/order/${order}` : null

    case NotificationMessageCode.CARD_ORDER_PAID: {
      const slug = routeData.cardOrderSlug ?? order
      return slug ? `/profile/gift-card-orders?autoOpen=${slug}` : null
    }

    case NotificationMessageCode.ORDER_BILL_FAILED_PRINTING:
    case NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING:
    case NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING:
      // Printer failure → navigate to order detail
      return order ? `/payment/${order}` : null

    default:
      return null
  }
}

// Module-level state — cho phép cancel pending notification nav khi có nav mới,
// và cho phép _layout.tsx check pending state để defer focusManager refetch.
let pendingNotificationTimeout: ReturnType<typeof setTimeout> | null = null
let pendingNotificationRoute: string | null = null

const COLD_START_DELAY_MS = 600
const NAV_LOCK_RETRY_MS = 120
const NAV_LOCK_MAX_RETRIES = 3

/** Dùng trong _layout.tsx để biết có notification cold-start nav đang pending. */
export function isNotificationNavigationPending(): boolean {
  return pendingNotificationRoute !== null
}

function schedulePush(route: string, delayMs: number): void {
  // Nếu đã có notification nav pending, cancel cái cũ — notification mới ghi đè.
  // Không dedupe: user có thể tap notification khác nhau liên tiếp, ưu tiên cái cuối.
  if (pendingNotificationTimeout) clearTimeout(pendingNotificationTimeout)
  pendingNotificationRoute = route

  const fire = () => {
    pendingNotificationTimeout = null
    let retries = 0
    const tryPush = () => {
      if (!isNavigationLocked()) {
        pendingNotificationRoute = null
        navigateNative.push(route)
        return
      }
      if (retries++ < NAV_LOCK_MAX_RETRIES) {
        setTimeout(tryPush, NAV_LOCK_RETRY_MS)
        return
      }
      // Lock vẫn active — bỏ cuộc để tránh navigate vào screen sai
      pendingNotificationRoute = null
    }
    tryPush()
  }

  if (delayMs <= 0) {
    fire()
  } else {
    pendingNotificationTimeout = setTimeout(fire, delayMs)
  }
}

/**
 * Navigate to the screen associated with a notification.
 *
 * @param data FCM data payload (raw, including stringified `data.payload`)
 * @param mode 'cold-start' applies a 600ms boot delay; 'background-tap' is immediate.
 *             Defaults to 'background-tap' (app warm) for safety — the caller
 *             that knows it's cold-start MUST pass 'cold-start' explicitly.
 * @returns true if navigation was scheduled.
 */
export function navigateFromNotification(
  data: Record<string, string> | undefined,
  mode: NotificationNavMode = 'background-tap',
): boolean {
  const routeData = parseNotificationData(data)
  const route = getRouteForMessage(routeData)

  if (!route) return false

  // Cold start trên iOS: JS bundle load + React mount + NavigationEngineProvider
  // mất 400-700ms. Cần ít nhất 500ms trước khi push để tránh router null.
  // Background tap: app warm, push ngay.
  const delay = mode === 'cold-start' ? COLD_START_DELAY_MS : 0
  schedulePush(route, delay)
  return true
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/notification-navigation.ts
git commit -m "fix(notification): split cold-start vs background-tap nav modes to remove warm-tap lag"
```

---

## Task 6: Module-level dedup, unified ID, launch guard, and order-ready bridge in useNotificationResponse

**Why:** Four bugs in one place — fixing them together because they all live in the same hook and share the same mental model.

1. **Dedup reset on re-auth.** `processedRef = useRef(new Set())` is created per hook instance. When `enabled` flips false → true (logout/login cycle), the effect re-runs but the ref is the same — _unless_ the hook unmounts. In the current tree it stays mounted, so this is "mostly fine"… until someone mounts/unmounts `NotificationProvider` (e.g., during a deep refactor or React Strict Mode). Promote the set to module level so it is stable regardless of mount semantics.

2. **Inconsistent dedup ID.** Path A uses `remoteMessage.messageId`. Path B uses `response.notification.request.identifier`. On iOS these are **different** values for the same logical notification. If both paths fire (e.g., expo-notifications also surfaces an FCM-originated tap), we navigate twice. We unify on a stable key: prefer the FCM `google.message_id` / `messageId` when present; fall back to `request.identifier`.

3. **iOS ghost response.** `getLastNotificationResponseAsync()` can return a response from a previous app session. Guard by comparing `response.notification.date` (ms since epoch) against `APP_LAUNCH_TIME_MS`.

4. **ORDER_READY tap doesn't show modal.** In foreground, `onMessage` calls `onOrderReady` → full-screen alert modal. From background/cold-start, we just navigate. That's inconsistent — the user expects to see "Đơn của bạn đã sẵn sàng" with sound + vibration regardless of how they entered. Plumb `onOrderReady` from the provider into the response hook.

**Files:**

- Modify: `hooks/use-notification-response.ts`

- [ ] **Step 1: Replace `hooks/use-notification-response.ts` content**

```ts
/**
 * useNotificationResponse — handle user tapping a notification (background + cold start).
 *
 * Two parallel paths — both are needed because FCM notifications delivered by
 * @react-native-firebase/messaging are NOT visible to expo-notifications on Android:
 *
 * Path A — RNFirebase (FCM data/notification messages from system tray):
 *   - messaging().getInitialNotification()  → cold start (app killed, opened via tap)
 *   - messaging().onNotificationOpenedApp() → background tap (app in background)
 *
 * Path B — expo-notifications (iOS local notifications, in-app scheduled alerts):
 *   - addNotificationResponseReceivedListener → background tap
 *   - getLastNotificationResponseAsync       → cold start fallback (iOS) — guarded
 *     by launch-time check to discard ghost responses from previous sessions.
 *
 * Both paths share a module-level dedup Set keyed by a unified ID derived from
 * FCM message_id when available, falling back to identifier / sentTime.
 *
 * ORDER_READY messages bypass simple navigation: they trigger the full-screen
 * alert modal (same UX as a foreground push), and only navigate when the user
 * dismisses it. This is handled by the caller — see notification-provider.tsx.
 */
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { isResponseFromThisSession } from '@/lib/app-launch-time'
import { navigateFromNotification } from '@/lib/notification-navigation'
import { useNotificationStore } from '@/stores/notification.store'

// Module-level dedup Set — survives hook re-mounts / auth toggles.
const processedIds = new Set<string>()
const MAX_PROCESSED_IDS = 100

function trimProcessed() {
  if (processedIds.size > MAX_PROCESSED_IDS) {
    const oldest = processedIds.values().next().value
    if (oldest !== undefined) processedIds.delete(oldest)
  }
}

function fcmUnifiedId(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): string {
  // RNFirebase exposes messageId; iOS APNS also exposes google.message_id in data.
  const dataMsgId =
    (remoteMessage.data?.['google.message_id'] as string | undefined) ??
    (remoteMessage.data?.['gcm.message_id'] as string | undefined)
  return (
    remoteMessage.messageId ??
    dataMsgId ??
    String(remoteMessage.sentTime ?? Date.now())
  )
}

function expoUnifiedId(response: Notifications.NotificationResponse): string {
  const data = response.notification.request.content.data as
    | Record<string, string>
    | undefined
  const dataMsgId = data?.['google.message_id'] ?? data?.['gcm.message_id']
  return dataMsgId ?? response.notification.request.identifier
}

function parsePayloadMessage(
  data: Record<string, string> | undefined,
): string | undefined {
  if (!data) return undefined
  if (typeof data.message === 'string') return data.message
  const raw = data.payload
  if (typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed.message
  } catch {
    return undefined
  }
}

export function useNotificationResponse(
  enabled = true,
  onOrderReady?: (title: string, body: string) => void,
) {
  useEffect(() => {
    if (!enabled) return

    // ── Path A: RNFirebase ────────────────────────────────────────────────────

    const handleFcmMessage = (
      remoteMessage: FirebaseMessagingTypes.RemoteMessage,
      mode: 'cold-start' | 'background-tap',
    ) => {
      const id = fcmUnifiedId(remoteMessage)
      if (processedIds.has(id)) return
      processedIds.add(id)
      trimProcessed()

      const rawData = remoteMessage.data as Record<string, string> | undefined

      useNotificationStore.getState().addNotification(
        {
          notification: {
            title: remoteMessage.notification?.title ?? undefined,
            body: remoteMessage.notification?.body ?? undefined,
          },
          data: rawData ?? {},
          messageId: id,
        },
        { markAsRead: false },
      )

      const code = parsePayloadMessage(rawData)
      if (
        code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET &&
        onOrderReady
      ) {
        const title =
          remoteMessage.notification?.title ?? 'Đơn của bạn đã sẵn sàng'
        const body = remoteMessage.notification?.body ?? ''
        onOrderReady(title, body)
        return
      }

      navigateFromNotification(rawData, mode)
    }

    // Cold start: app was killed and opened by tapping a system notification.
    // Firebase holds this until consumed — safe to call after auth rehydrates.
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) handleFcmMessage(remoteMessage, 'cold-start')
      })
      .catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[FCM] getInitialNotification failed:', e),
      )

    // Background tap: app was in background (not killed) and user tapped notification.
    const unsubOpened = messaging().onNotificationOpenedApp((rm) =>
      handleFcmMessage(rm, 'background-tap'),
    )

    // ── Path B: expo-notifications (iOS local / in-app alerts) ───────────────

    const handleExpoResponse = (
      response: Notifications.NotificationResponse,
      mode: 'cold-start' | 'background-tap',
    ) => {
      const id = expoUnifiedId(response)
      if (processedIds.has(id)) return
      processedIds.add(id)
      trimProcessed()

      const content = response.notification.request.content
      const data = content.data as Record<string, string> | undefined

      useNotificationStore.getState().addNotification(
        {
          notification: {
            title: content.title ?? undefined,
            body: content.body ?? undefined,
          },
          data: data ?? {},
          messageId: id,
        },
        { markAsRead: false },
      )

      const code = parsePayloadMessage(data)
      if (
        code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET &&
        onOrderReady
      ) {
        onOrderReady(
          content.title ?? 'Đơn của bạn đã sẵn sàng',
          content.body ?? '',
        )
        return
      }

      navigateFromNotification(data, mode)
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => handleExpoResponse(response, 'background-tap'),
    )

    // Cold-start fallback for iOS local notifications. Guard against ghost
    // responses left over from a previous app session — only consume if the
    // notification's delivery date falls within this session's window.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return
        const dateMs = response.notification.date
        if (!isResponseFromThisSession(dateMs)) {
          // eslint-disable-next-line no-console
          console.log(
            '[Notifications] Discarding ghost response from previous session:',
            new Date(dateMs).toISOString(),
          )
          return
        }
        handleExpoResponse(response, 'cold-start')
      })
      .catch((e) =>
        // eslint-disable-next-line no-console
        console.warn(
          '[Notifications] getLastNotificationResponseAsync failed:',
          e,
        ),
      )

    return () => {
      unsubOpened()
      subscription.remove()
    }
  }, [enabled, onOrderReady])
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-notification-response.ts
git commit -m "fix(notification): module-level dedup, unified ID, launch-time guard, order-ready bridge"
```

---

## Task 7: Wire `showOrderReady` into `useNotificationResponse`

**Why:** With Task 6 done, the response hook now accepts an `onOrderReady` callback but no one passes it. The provider already has `showOrderReady` from `useOrderReadyAlert` — wire it through.

**Files:**

- Modify: `providers/notification-provider.tsx`

- [ ] **Step 1: Pass `showOrderReady` to `useNotificationResponse`**

Replace the existing call site:

```tsx
// providers/notification-provider.tsx (snippet — change the line below)
// BEFORE:
// useNotificationResponse(isAuthenticated)
// AFTER:
useNotificationResponse(isAuthenticated, showOrderReady)
```

Full updated `providers/notification-provider.tsx`:

```tsx
/**
 * NotificationProvider — orchestrates all notification hooks.
 *
 * Responsibilities:
 * 1. Register FCM token when authenticated (T2+T3)
 * 2. Start token refresh scheduler (T4)
 * 3. Listen foreground notifications → toast + sound (T5)
 * 4. Handle background tap → navigate (T7+T8)
 * 5. Show permission dialog when denied (T12)
 * 6. Show order-ready full-screen alert when order is ready for pickup,
 *    regardless of foreground / background / cold-start entry path.
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
  const {
    isVisible,
    title,
    body,
    show: showOrderReady,
    hide: hideOrderReady,
  } = useOrderReadyAlert()

  // T2+T3: Get FCM token + register with server (only when authenticated)
  const { permissionDenied } = useRegisterDeviceToken(isAuthenticated)

  // T5: Foreground listener — show order-ready modal for ORDER_NEEDS_READY_TO_GET,
  // toast + sound for others.
  useNotificationListener(isAuthenticated, showOrderReady)

  // T7+T8: Background tap + cold start — same order-ready bridge so the modal
  // appears regardless of entry path (foreground push, background tap, cold start).
  useNotificationResponse(isAuthenticated, showOrderReady)

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

- [ ] **Step 2: Commit**

```bash
git add providers/notification-provider.tsx
git commit -m "feat(notification): show order-ready modal for background and cold-start taps"
```

---

## Task 8: Auto mark-read on order-ready modal show

**Why:** The user has unmistakably _seen_ the notification when the full-screen modal pops with sound + vibration. Leaving it as unread is bookkeeping noise. We mark it read as soon as `show()` is called. The latest unread ORDER_READY entry is the one to mark.

**Files:**

- Modify: `hooks/use-order-ready-alert.ts`

- [ ] **Step 1: Replace `hooks/use-order-ready-alert.ts` content**

```ts
import { useCallback, useState } from 'react'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'

interface OrderReadyAlertState {
  isVisible: boolean
  title: string
  body: string
}

const HIDDEN: OrderReadyAlertState = { isVisible: false, title: '', body: '' }

function markLatestOrderReadyAsRead() {
  const store = useNotificationStore.getState()
  // Find the newest unread ORDER_NEEDS_READY_TO_GET entry — that's the one
  // the modal just surfaced. Notifications are prepended, so the first match
  // in the list is the newest.
  const target = store.notifications.find(
    (n) =>
      !n.isRead &&
      // store messages are normalized to message code string in transform
      (n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET ||
        // also catch the case where store.message is the title — read code
        // off metadata if BE included it under data.message
        (n as unknown as { type?: string }).type ===
          NotificationMessageCode.ORDER_NEEDS_READY_TO_GET),
  )
  if (target) store.markAsRead(target.slug)
}

export function useOrderReadyAlert() {
  const [state, setState] = useState<OrderReadyAlertState>(HIDDEN)

  const show = useCallback((title: string, body: string) => {
    setState({ isVisible: true, title, body })
    // User has seen the alert — mark the latest order-ready notification read
    // so the badge and list reflect that immediately.
    markLatestOrderReadyAsRead()
  }, [])

  const hide = useCallback(() => {
    setState(HIDDEN)
  }, [])

  return { ...state, show, hide }
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-order-ready-alert.ts
git commit -m "feat(notification): auto mark-read order-ready entry when alert modal shows"
```

---

## Task 9: Switch foreground listener to shared sound module + drop dispose race

**Why:** Now that `lib/notification-sound.ts` owns the cache:

- Replace inline sound logic with imports from the shared module.
- Remove the `disposeSound()` call from the effect cleanup. The sound is process-scoped, not auth-scoped; the next user benefits from preload. The shared module's reference-counted `disposeNotificationSound` is still exported should we ever need explicit teardown.

**Files:**

- Modify: `hooks/use-notification-listener.ts`

- [ ] **Step 1: Replace `hooks/use-notification-listener.ts` content**

```ts
/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - For ORDER_NEEDS_READY_TO_GET: calls onOrderReady (full-screen alert) instead
 *   of regular toast + sound
 * - For all other codes: shows toast + plays notification.mp3 via shared module
 *
 * Sound lifecycle is managed by lib/notification-sound.ts (preloaded at app
 * startup, single in-flight playback counter, race-safe dispose). We do NOT
 * unload the cached sound on effect cleanup — it is process-scoped.
 */
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { playNotificationSound } from '@/lib/notification-sound'
import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToastInternal } from '@/providers/toast-provider'

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
      // eslint-disable-next-line no-console
      console.log(
        '[FCM] foreground message:',
        JSON.stringify(remoteMessage, null, 2),
      )

      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      // data.message is inside the stringified data.payload — parse it first
      let parsedPayload: Record<string, string> = {}
      try {
        parsedPayload = JSON.parse(
          (remoteMessage.data?.payload as string | undefined) ?? '{}',
        ) as Record<string, string>
      } catch {
        /* ignore invalid JSON */
      }
      const code = parsedPayload.message ?? remoteMessage.data?.message

      if (code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET) {
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
      // Intentionally NOT disposing the cached sound — it is process-scoped
      // (managed by lib/notification-sound.ts) and benefits the next user.
    }
  }, [enabled, onOrderReady])
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-notification-listener.ts
git commit -m "refactor(notification): use shared sound module, drop dispose race in listener cleanup"
```

---

## Task 10: Update index.js doc-comment to reflect the new contract

**Why:** `index.js` documents the import order. Two of the files just changed semantics — keep the comment accurate so future contributors don't reintroduce a non-dummy background handler or break the channel-readiness gate.

**Files:**

- Modify: `index.js`

- [ ] **Step 1: Replace `index.js` content**

```js
/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. firebase-background-handler — dummy anti-warning stub. BE gửi notification
 *    message (FCM SDK render natively), nên handler này chỉ tồn tại để silence
 *    warning của @react-native-firebase/messaging.
 * 2. notification-setup — setNotificationHandler + Android channel readiness
 *    Promise + preload notification.mp3. Phải chạy trước khi token registration
 *    bắt đầu (channels phải tồn tại trước khi nhận push trên Android).
 * 3. navigation-setup: enableScreens(true) + enableFreeze(true) — trước khi
 *    bất kỳ Screen nào render.
 * 4. expo-router/entry — registerComponent + mount app.
 */
import './lib/firebase-background-handler'
import './lib/notification-setup'
import './lib/navigation-setup'
import 'expo-router/entry'
```

- [ ] **Step 2: Commit**

```bash
git add index.js
git commit -m "docs(notification): update entry import comment to reflect new contract"
```

---

## Task 11: Final type + lint sweep

**Why:** All edits above touch the typed surface area of the notification flow. Run a final check before pushing so failures are caught locally, not in CI.

- [ ] **Step 1: Run typecheck + lint**

```bash
npm run check
```

- [ ] **Step 2: If typecheck flags any issue in the changed files, fix in place**

Common fix surfaces:

- `Record<string, string>` vs `Record<string, unknown>` mismatches around `remoteMessage.data` — cast through `as unknown as Record<string, string>` only when narrowing is impossible.
- `useOrderReadyAlert` type assertion on `n.type` — if `INotification.type` is already typed, remove the unsafe cast and use the typed field directly.

- [ ] **Step 3: Verify circular dependencies have not been introduced**

```bash
npm run check-circular
```

- [ ] **Step 4: Commit any fix-up**

```bash
git add -p
git commit -m "chore(notification): typecheck + lint cleanup after standardization"
```

---

## Summary of Changes

| Issue (audit ID)                                       | Fix landed in                 |
| ------------------------------------------------------ | ----------------------------- |
| #1 background handler dead code                        | Task 4                        |
| #2 iOS ghost response                                  | Task 1 + Task 6               |
| #3 600ms delay on background tap                       | Task 5 + Task 6 (passes mode) |
| #4 ORDER_READY tap doesn't show modal in bg/cold-start | Task 6 + Task 7               |
| #5 dedup Set reset on re-auth                          | Task 6 (module-level set)     |
| #6 dedup ID inconsistency                              | Task 6 (unified ID helper)    |
| #7 channel setup fire-and-forget                       | Task 3                        |
| #8 auto mark-read on alert show                        | Task 8                        |
| #9 sound lazy load delay                               | Task 2 + Task 3 (preload)     |
| #10 sound dispose race                                 | Task 2 + Task 9               |
