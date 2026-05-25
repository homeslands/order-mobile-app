# Order Ready Alert — Long Ring & Long Vibration

**Date:** 2026-05-19
**Feature:** Prominent alert when customer's order is ready for pickup
**Trigger:** FCM message with `data.message = 'order-needs-ready-to-get'`

---

## Goal

When the backend signals that a customer's order is ready, their device should alert them like a store pager — continuous vibration and a longer sound — so they know to come collect their order. The alert must be noticeable even if the customer is using another app or has their screen locked, but must respect the user's deliberate silence choice (silent mode is not overridden).

---

## Behavior by State

| State                             | Sound                                                          | Vibration                                        | UI                                                                   |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| **Foreground**                    | `order_ready.wav` looping until dismissed                      | Continuous pattern until dismissed               | Full-screen modal overlay                                            |
| **Background / Killed (Android)** | `order_ready.wav` single play (~15s) via `order-ready` channel | ~4s pattern via channel                          | Heads-up banner; tap → order detail                                  |
| **Background / Killed (iOS)**     | `order_ready.wav` single play via APNs                         | OS default                                       | Heads-up banner; `time-sensitive` bypasses Focus Mode but not silent |
| **Silent mode**                   | No sound                                                       | Vibration only (Android foreground + background) | Same UI                                                              |

---

## Architecture

### 1. New sound file: `order_ready.wav`

- Duration: ~15 seconds
- Format: WAV (required by Android `res/raw/`, compatible with iOS)
- Locations:
  - `assets/sound/order_ready.wav` — for foreground playback via `expo-av`
  - `android/app/src/main/res/raw/order_ready.wav` — for background Android channel
  - iOS bundle via `app.json` plugin `sounds` array
- Foreground: looped via `sound.setIsLoopingAsync(true)`
- Background: played once by the OS via channel / APNs

### 2. New Android notification channel: `order-ready`

Created in `lib/notification-setup.ts` alongside existing `default` channel.

```
channelId:        'order-ready'
name:             'Thông báo lấy đơn'
importance:       MAX
vibrationPattern: [0, 1000, 500, 1000, 500, 1000, 500, 1000]  (~4s)
sound:            'order_ready'
lightColor:       '#F7A737'
```

**Note:** Android channel properties are locked after first creation on a device. This is a new channel ID so it is safe to create fresh.

BE must send `android.notification.channelId = 'order-ready'` for `order-needs-ready-to-get` messages. Messages without this field fall back to `default` channel (existing behavior preserved).

### 3. iOS APNs config (BE side)

BE sends for `order-needs-ready-to-get`:

```json
"apns": {
  "payload": {
    "aps": {
      "sound": { "name": "order_ready.wav", "critical": 0, "volume": 1.0 },
      "interruption-level": "time-sensitive"
    }
  }
}
```

`time-sensitive` bypasses Focus Mode (iOS 15+). Does not bypass silent mode — this is acceptable for an F&B app.

### 4. `OrderReadyAlertModal` component

**File:** `components/notification/order-ready-alert-modal.tsx`

A full-screen modal that renders on top of all content when the app is in the foreground and an `order-needs-ready-to-get` message arrives.

**Responsibilities:**

- Play `order_ready.wav` in a loop (`setIsLoopingAsync(true)`)
- Call `Vibration.vibrate([0, 1000, 500, 1000, 500, 1000, 500, 1000], true)` (repeating)
- Show order title + body from notification payload
- Provide "Đã lấy đơn" button: stops sound, stops vibration, dismisses modal
- Auto-dismiss and stop alert after 60 seconds with no interaction
- Set iOS audio mode `playsInSilentModeIOS: false` (intentional — respect silent switch)

**State:** Controlled by `useOrderReadyAlert` hook (see §5).

**Mounted in:** `providers/notification-provider.tsx` — always present when authenticated.

### 5. `useOrderReadyAlert` hook

**File:** `hooks/use-order-ready-alert.ts`

Manages the visibility state of `OrderReadyAlertModal`.

```
show(title: string, body: string) → set visible + store message text
hide()                             → set hidden + stop sound/vibration
```

Used by `useNotificationListener` to trigger the alert.

### 6. Modified `useNotificationListener`

When a foreground FCM message arrives with `data.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET`:

- Call `useOrderReadyAlert.show(title, body)` — triggers full-screen modal
- Skip the regular toast and regular sound

For all other message codes: existing behavior unchanged (toast + `notification.mp3`).

---

## Data Flow

```
FCM payload (order-needs-ready-to-get)
  │
  ├─ App foreground
  │    └─ useNotificationListener.onMessage
  │         └─ data.message === ORDER_NEEDS_READY_TO_GET
  │              └─ useOrderReadyAlert.show()
  │                   ├─ OrderReadyAlertModal renders full-screen
  │                   ├─ order_ready.wav loops
  │                   └─ Vibration repeats
  │
  └─ App background / killed
       ├─ Android: Firebase renders via channel 'order-ready'
       │           → order_ready.wav (1×) + vibration pattern
       └─ iOS: APNs renders with time-sensitive + order_ready.wav (1×)
```

---

## Out of Scope

- Bypassing iOS silent mode (requires Critical Alerts entitlement — Apple does not approve for F&B)
- Bypassing Android Do Not Disturb (requires `ACCESS_NOTIFICATION_POLICY` — too invasive for F&B)
- Looping sound in background/killed state (OS limitation on both platforms)
- VoIP / PushKit (reserved for voice call apps)

---

## BE Integration Checklist

For `order-needs-ready-to-get` FCM payload, BE must include:

- `android.notification.channelId = 'order-ready'`
- `apns.payload.aps.interruption-level = 'time-sensitive'`
- `apns.payload.aps.sound.name = 'order_ready.wav'`
- `notification.title` and `notification.body` as usual

All other notification types: no change required.
