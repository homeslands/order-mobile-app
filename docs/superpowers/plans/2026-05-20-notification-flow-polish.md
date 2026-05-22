# Notification Flow Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 issues flagged in the Opus code review of the ORDER_READY notification flow: shared foreground dedup, bar positioning below TabHeader, and UX polish (animation, haptic, dismiss feedback, shorter text, platform-aware cold-start delay).

**Architecture:** Extract a `lib/notification-dedup.ts` module so both the foreground listener and the background/cold-start response handler share a single `processedIds` Set — eliminating the foreground double-fire bug. Fix `OrderReadyPendingBar` positioning to sit below `TabHeader` using an exported height constant, then layer in Reanimated enter/exit animation + haptic. Reduce `COLD_START_DELAY_MS` on Android where JS boots faster.

**Tech Stack:** React Native Reanimated 4.1 (`useSharedValue`, `useAnimatedStyle`, `withTiming`), `expo-haptics`, Zustand, TypeScript strict.

---

## File Structure

```
lib/
  notification-dedup.ts        (create — shared processedIds Set: hasProcessed, markProcessed, clearProcessed)
hooks/
  use-notification-listener.ts (modify — import dedup, add ID extraction + dedupe check before addNotification)
  use-notification-response.ts (modify — replace local processedIds/trim with imports from notification-dedup)
providers/
  notification-provider.tsx    (modify — call clearProcessed() when isAuthenticated goes false)
constants/
  motion.ts                    (modify — add TIMING_CONFIGS.bannerSlide: { duration: 250 })
components/layout/
  tab-header.tsx               (modify — export TAB_HEADER_CONTENT_HEIGHT = 48)
components/notification/
  order-ready-pending-bar.tsx  (modify — new top position, Animated.View wrapper, animation, haptic, dismiss toast, shorter text)
lib/
  notification-navigation.ts   (modify — COLD_START_DELAY_MS platform-aware: 400 Android / 600 iOS)
__tests__/lib/
  notification-dedup.test.ts   (create — unit tests for the dedup module)
```

---

## Task 1: Extract shared dedup module + wire to listener + clear on logout

**Why:** `use-notification-listener.ts` (foreground) has no dedup — if FCM redelivers the same `messageId` when the app returns to foreground, toast + sound fire twice and a duplicate entry lands in the store. `processedIds` lives only in `use-notification-response.ts`, so foreground can't share it. Extracting to a module fixes both the sharing and the logout bleed (user A's processed IDs leaking to user B after re-login).

**Files:**
- Create: `lib/notification-dedup.ts`
- Create: `__tests__/lib/notification-dedup.test.ts`
- Modify: `hooks/use-notification-listener.ts`
- Modify: `hooks/use-notification-response.ts`
- Modify: `providers/notification-provider.tsx`

- [ ] **Step 1: Write the failing test first**

Create `__tests__/lib/notification-dedup.test.ts`:

```ts
import { hasProcessed, markProcessed, clearProcessed } from '@/lib/notification-dedup'

describe('notification-dedup', () => {
  beforeEach(() => {
    clearProcessed()
  })

  it('returns false for an unknown id', () => {
    expect(hasProcessed('abc')).toBe(false)
  })

  it('returns true after marking an id', () => {
    markProcessed('abc')
    expect(hasProcessed('abc')).toBe(true)
  })

  it('clearProcessed removes all entries', () => {
    markProcessed('abc')
    markProcessed('def')
    clearProcessed()
    expect(hasProcessed('abc')).toBe(false)
    expect(hasProcessed('def')).toBe(false)
  })

  it('evicts the oldest entry when over the 100-entry cap', () => {
    for (let i = 0; i <= 100; i++) markProcessed(`id-${i}`)
    // id-0 was the first inserted — must be evicted
    expect(hasProcessed('id-0')).toBe(false)
    expect(hasProcessed('id-100')).toBe(true)
  })

  it('does not evict when at exactly the cap', () => {
    for (let i = 0; i < 100; i++) markProcessed(`id-${i}`)
    expect(hasProcessed('id-0')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — must fail with "Cannot find module"**

```bash
npx jest __tests__/lib/notification-dedup.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/notification-dedup'`

- [ ] **Step 3: Create `lib/notification-dedup.ts`**

```ts
/**
 * notification-dedup — process-scoped message ID dedup shared between
 * foreground listener (use-notification-listener) and background/cold-start
 * response handler (use-notification-response).
 *
 * Module-level state survives hook re-mounts and auth toggles.
 * Call clearProcessed() on logout to prevent cross-user dedup leaks.
 */

const processedIds = new Set<string>()
const MAX_PROCESSED_IDS = 100

export function hasProcessed(id: string): boolean {
  return processedIds.has(id)
}

export function markProcessed(id: string): void {
  processedIds.add(id)
  if (processedIds.size > MAX_PROCESSED_IDS) {
    const oldest = processedIds.values().next().value
    if (oldest !== undefined) processedIds.delete(oldest)
  }
}

export function clearProcessed(): void {
  processedIds.clear()
}
```

- [ ] **Step 4: Run test — must pass**

```bash
npx jest __tests__/lib/notification-dedup.test.ts --no-coverage
```

Expected: PASS — 5 tests

- [ ] **Step 5: Wire foreground listener**

Replace the full content of `hooks/use-notification-listener.ts` with:

```ts
/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store (deduped via notification-dedup)
 * - Shows toast + plays notification sound for all message codes
 *
 * Sound lifecycle managed by lib/notification-sound.ts (preloaded at startup).
 */
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { hasProcessed, markProcessed } from '@/lib/notification-dedup'
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

function fcmForegroundId(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): string {
  const dataMsgId =
    (remoteMessage.data?.['google.message_id'] as string | undefined) ??
    (remoteMessage.data?.['gcm.message_id'] as string | undefined)
  return (
    remoteMessage.messageId ??
    dataMsgId ??
    String(remoteMessage.sentTime ?? Date.now())
  )
}

export function useNotificationListener(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const id = fcmForegroundId(remoteMessage)
      if (hasProcessed(id)) return
      markProcessed(id)

      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) showToastInternal(title, body, 'info')

      playNotificationSound().catch(() => {})
    })

    return () => {
      unsubscribe()
      // Intentionally NOT disposing the cached sound — process-scoped,
      // managed by lib/notification-sound.ts.
    }
  }, [enabled])
}
```

- [ ] **Step 6: Migrate `use-notification-response.ts` to shared dedup**

Replace the module-level block (lines 28–37, the `processedIds` Set + `MAX_PROCESSED_IDS` + `trimProcessed`) with an import. Also replace every usage of `processedIds.has`/`processedIds.add`/`trimProcessed()` with the imported functions.

The file after changes — only the **changed sections** (rest stays identical):

At the top, replace:
```ts
// Module-level — survives hook re-mounts / auth toggles; bounded to MAX_PROCESSED_IDS.
const processedIds = new Set<string>()
const MAX_PROCESSED_IDS = 100

function trimProcessed() {
  if (processedIds.size > MAX_PROCESSED_IDS) {
    const oldest = processedIds.values().next().value
    if (oldest !== undefined) processedIds.delete(oldest)
  }
}
```

With:
```ts
import { hasProcessed, markProcessed } from '@/lib/notification-dedup'
```

(Place after the existing `@/lib/...` imports.)

Inside `handleFcmMessage`, replace:
```ts
      const id = fcmUnifiedId(remoteMessage)
      if (processedIds.has(id)) return
      processedIds.add(id)
      trimProcessed()
```

With:
```ts
      const id = fcmUnifiedId(remoteMessage)
      if (hasProcessed(id)) return
      markProcessed(id)
```

Inside `handleExpoResponse`, replace:
```ts
      const id = expoUnifiedId(response)
      if (processedIds.has(id)) return
      processedIds.add(id)
      trimProcessed()
```

With:
```ts
      const id = expoUnifiedId(response)
      if (hasProcessed(id)) return
      markProcessed(id)
```

- [ ] **Step 7: Clear processed IDs on logout in `notification-provider.tsx`**

Add import after existing `@/lib/...` imports:
```ts
import { clearProcessed } from '@/lib/notification-dedup'
```

Add a new `useEffect` after the existing `useEffect` blocks (before the `useState` for permission sheet):
```tsx
useEffect(() => {
  if (!isAuthenticated) {
    clearProcessed()
  }
}, [isAuthenticated])
```

- [ ] **Step 8: Verify typecheck + tests**

```bash
npm run check
npx jest __tests__/lib/notification-dedup.test.ts --no-coverage
```

Expected: both pass, 5 tests green.

- [ ] **Step 9: Commit**

```bash
git add lib/notification-dedup.ts __tests__/lib/notification-dedup.test.ts hooks/use-notification-listener.ts hooks/use-notification-response.ts providers/notification-provider.tsx
git commit -m "refactor(notification): extract shared dedup module, wire foreground listener, clear on logout"
```

---

## Task 2: Bar polish — positioning + dismiss toast + animation + haptic + shorter text

**Why:** The bar's `top: STATIC_TOP_INSET` places it at exactly the same offset as the TabHeader's content, so the bar overlays the logo/bell/search icons. Moving it to `STATIC_TOP_INSET + TAB_HEADER_CONTENT_HEIGHT` puts it immediately below the header. Tap-X gives no feedback — user doesn't know where to find the order again. No animation makes the bar feel abrupt. No haptic misses a key "attention" cue.

**Files:**
- Modify: `constants/motion.ts` (add `bannerSlide` timing preset)
- Modify: `components/layout/tab-header.tsx` (export `TAB_HEADER_CONTENT_HEIGHT`)
- Modify: `components/notification/order-ready-pending-bar.tsx` (positioning, animation, haptic, text, dismiss toast)

- [ ] **Step 1: Add `bannerSlide` timing preset to `constants/motion.ts`**

Current `TIMING_CONFIGS` (around line 137):
```ts
export const TIMING_CONFIGS = {
  dotFade: { duration: 180 } as const,
} as const
```

Replace with:
```ts
export const TIMING_CONFIGS = {
  dotFade: { duration: 180 } as const,
  /** Ambient notification bar enter/exit — quick but not jarring. */
  bannerSlide: { duration: 250 } as const,
} as const
```

- [ ] **Step 2: Export `TAB_HEADER_CONTENT_HEIGHT` from `components/layout/tab-header.tsx`**

The constants at the top of `tab-header.tsx` are:
```ts
const LOGO_WIDTH = 120
const LOGO_HEIGHT = 32
const HEADER_PADDING_H = 16
const HEADER_PADDING_BOTTOM = 12
const HEADER_PADDING_TOP = 4
```

Add this export immediately after those constants (before `TabHeader` component definition):
```ts
/** Height of the header row (excluding status bar inset) — used to position overlays below the header. */
export const TAB_HEADER_CONTENT_HEIGHT =
  HEADER_PADDING_TOP + LOGO_HEIGHT + HEADER_PADDING_BOTTOM // 4 + 32 + 12 = 48
```

- [ ] **Step 3: Rewrite `components/notification/order-ready-pending-bar.tsx`**

Replace the entire file with:

```tsx
/**
 * OrderReadyPendingBar — persistent ambient bar shown when the customer opens
 * the app via icon and has an unread ORDER_NEEDS_READY_TO_GET notification.
 *
 * No push notification tap needed. The bar reads the Zustand notification store
 * directly so it appears / disappears reactively as read-state changes.
 *
 * Tap bar  → markAsRead + navigate to order detail
 * Tap ✕    → markAsRead + toast hint (not silent dismiss)
 *
 * Positioned below TabHeader so bell/logo/search remain visible.
 * Animates in/out with Reanimated withTiming + haptic on appear.
 */
import * as Haptics from 'expo-haptics'
import { X } from 'lucide-react-native'
import { memo, useCallback, useEffect } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { TAB_HEADER_CONTENT_HEIGHT } from '@/components/layout/tab-header'
import { colors } from '@/constants'
import { NotificationMessageCode } from '@/constants/notification.constant'
import { TIMING_CONFIGS } from '@/constants/motion'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'
import { showToastInternal } from '@/providers/toast-provider'
import { useNotificationStore } from '@/stores/notification.store'

const BAR_TOP = STATIC_TOP_INSET + TAB_HEADER_CONTENT_HEIGHT

export const OrderReadyPendingBar = memo(function OrderReadyPendingBar() {
  const pendingSlug = useNotificationStore((s) =>
    s.notifications.find(
      (n) =>
        !n.isRead &&
        n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
    )?.slug ?? null,
  )

  const pendingOrderSlug = useNotificationStore((s) =>
    pendingSlug
      ? (s.notifications.find((n) => n.slug === pendingSlug)?.metadata.order ??
          null)
      : null,
  )

  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const isDark = useColorScheme() === 'dark'

  const visible = pendingSlug !== null
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-40)

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, TIMING_CONFIGS.bannerSlide)
      translateY.value = withTiming(0, TIMING_CONFIGS.bannerSlide)
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {})
    } else {
      opacity.value = withTiming(0, TIMING_CONFIGS.bannerSlide)
      translateY.value = withTiming(-40, TIMING_CONFIGS.bannerSlide)
    }
  }, [visible, opacity, translateY])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const handleBarPress = useCallback(() => {
    if (!pendingSlug) return
    markAsRead(pendingSlug)
    if (pendingOrderSlug) {
      navigateNative.push(`/order/${pendingOrderSlug}`)
    }
  }, [pendingSlug, pendingOrderSlug, markAsRead])

  const handleDismiss = useCallback(() => {
    if (!pendingSlug) return
    markAsRead(pendingSlug)
    showToastInternal('Đã ẩn nhắc nhở', 'Xem lại ở mục Thông báo', 'info')
  }, [pendingSlug, markAsRead])

  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const textColor = colors.white.light

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[s.wrapper, { top: BAR_TOP }, animatedStyle]}
    >
      <Pressable
        style={[s.bar, { backgroundColor: primaryColor }]}
        onPress={handleBarPress}
        accessibilityRole="button"
        accessibilityLabel="Đơn hàng đã sẵn sàng — Nhấn để xem chi tiết"
      >
        <Text style={[s.message, { color: textColor }]} numberOfLines={1}>
          Đơn đã sẵn sàng — nhận ngay 🎉
        </Text>
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          style={s.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo"
        >
          <X size={16} color={textColor} />
        </Pressable>
      </Pressable>
    </Animated.View>
  )
})

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run check
```

Expected: no errors. Common issues:
- If `Animated` from `react-native-reanimated` isn't found, check import — it should be `import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'`.
- If `TAB_HEADER_CONTENT_HEIGHT` import fails, verify step 2 exported it correctly.
- If `TIMING_CONFIGS.bannerSlide` errors, verify step 1 added it.

- [ ] **Step 5: Commit**

```bash
git add constants/motion.ts components/layout/tab-header.tsx components/notification/order-ready-pending-bar.tsx
git commit -m "fix(notification): position bar below tab header, add slide animation + haptic + dismiss toast"
```

---

## Task 3: Dynamic cold-start delay by platform

**Why:** Cold-start delay is fixed at 600ms for both iOS and Android. Android's JS engine (Hermes) initialises faster — typically 350-450ms vs 500-700ms on iOS. A platform-specific value removes the extra 200ms lag on Android without risking navigation-before-router-ready on iOS.

**Files:**
- Modify: `lib/notification-navigation.ts`

- [ ] **Step 1: Add `Platform` import and replace the constant**

In `lib/notification-navigation.ts`, the current import block ends with:
```ts
import { NotificationMessageCode } from '@/constants'
import { isNavigationLocked, navigateNative } from '@/lib/navigation'
```

Add `Platform` to the react-native import:
```ts
import { Platform } from 'react-native'
import { NotificationMessageCode } from '@/constants'
import { isNavigationLocked, navigateNative } from '@/lib/navigation'
```

Replace:
```ts
const COLD_START_DELAY_MS = 600
```

With:
```ts
// Android (Hermes) bootstraps in ~350-450ms; iOS needs 500-700ms.
const COLD_START_DELAY_MS = Platform.OS === 'android' ? 400 : 600
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/notification-navigation.ts
git commit -m "perf(notification): reduce cold-start nav delay to 400ms on Android"
```

---

## Summary

| Issue (from code review) | Fix | Task |
|---|---|---|
| Foreground listener double-fires on FCM redeliver | Shared `processedIds` via `lib/notification-dedup.ts` | Task 1 |
| `processedIds` bleeds across user re-login | `clearProcessed()` on `isAuthenticated → false` | Task 1 |
| Bar overlays TabHeader — bell/logo hidden | `top: STATIC_TOP_INSET + TAB_HEADER_CONTENT_HEIGHT` | Task 2 |
| Dismiss X gives no feedback | Toast "Đã ẩn nhắc nhở — Xem lại ở mục Thông báo" | Task 2 |
| Bar pops in without animation | `withTiming` slide-down + opacity enter/exit | Task 2 |
| No haptic when bar appears | `Haptics.notificationAsync(Success)` on visible | Task 2 |
| Text too long for iPhone SE | "Đơn đã sẵn sàng — nhận ngay 🎉" | Task 2 |
| Cold-start 600ms fixed on Android (too slow) | `Platform.OS === 'android' ? 400 : 600` | Task 3 |
