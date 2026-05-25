# Order-Ready Customer Notification Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế full-screen alarm modal (thiết kế cho nhân viên) bằng UX phù hợp với khách hàng — toast nhẹ khi foreground, navigate thẳng khi tap thông báo, và persistent bar nhắc nhở khi mở app qua icon.

**Architecture:**

- Xóa `OrderReadyAlertModal` và `useOrderReadyAlert` — không cần nữa với khách hàng
- Đơn giản hoá `useNotificationListener` và `useNotificationResponse` — ORDER_READY xử lý như thông báo thường, không còn callback `onOrderReady`
- Thêm `OrderReadyPendingBar` — component đọc store, hiện sticky bar phía trên nếu có ORDER_READY chưa đọc, tự ẩn khi mark-as-read

**Tech Stack:** React Native 0.81, Expo Router, Zustand, NativeWind, TypeScript strict.

---

## File Structure

```
components/notification/
  order-ready-alert-modal.tsx        (delete)
  order-ready-pending-bar.tsx        (create — sticky bar for "opened via icon" case)
hooks/
  use-order-ready-alert.ts           (delete)
  use-notification-listener.ts       (modify — remove onOrderReady path)
  use-notification-response.ts       (modify — remove onOrderReady param + ORDER_READY special path)
providers/
  notification-provider.tsx          (modify — remove modal, useOrderReadyAlert, onOrderReady wiring)
app/(tabs)/
  _layout.tsx                        (modify — add OrderReadyPendingBar)
```

---

## Task 1: Xóa OrderReadyAlertModal và useOrderReadyAlert

**Why:** Hai file này implement full-screen alarm — UX sai hoàn toàn cho khách hàng. Xóa trước để compiler enforce việc clean up tất cả consumers.

**Files:**

- Delete: `components/notification/order-ready-alert-modal.tsx`
- Delete: `hooks/use-order-ready-alert.ts`
- Modify: `providers/notification-provider.tsx`

- [ ] **Step 1: Xóa hai file**

```bash
rm components/notification/order-ready-alert-modal.tsx
rm hooks/use-order-ready-alert.ts
```

- [ ] **Step 2: Rewrite notification-provider.tsx**

Xóa toàn bộ `useOrderReadyAlert`, `showOrderReady`, `hideOrderReady`, `OrderReadyAlertModal`. Giữ lại permission sheet và token scheduler.

```tsx
/**
 * NotificationProvider — orchestrates all notification hooks.
 *
 * Responsibilities:
 * 1. Register FCM token when authenticated
 * 2. Start token refresh scheduler
 * 3. Listen foreground notifications → toast + sound
 * 4. Handle background tap + cold start → navigate
 * 5. Show permission dialog when denied
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { NotificationPermissionSheet } from '@/components/notification/notification-permission-sheet'
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

  const { permissionDenied } = useRegisterDeviceToken(isAuthenticated)

  useNotificationListener(isAuthenticated)

  useNotificationResponse(isAuthenticated)

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

  const [showPermissionSheet, setShowPermissionSheet] = useState(false)
  const hasShownRef = useRef(false)

  useEffect(() => {
    if (permissionDenied && isAuthenticated && !hasShownRef.current) {
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
    <NotificationPermissionSheet
      visible={showPermissionSheet}
      onClose={handleClosePermission}
    />
  )
}
```

- [ ] **Step 3: Verify typecheck fails on onOrderReady references**

```bash
npm run typecheck 2>&1 | grep -E "onOrderReady|useOrderReadyAlert|OrderReadyAlertModal"
```

Expected: errors referencing `onOrderReady` in `use-notification-listener.ts` và `use-notification-response.ts` — confirms those need fixing in Task 2 và 3.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(notification): remove order-ready alarm modal and hook"
```

---

## Task 2: Đơn giản hoá useNotificationListener

**Why:** Hook hiện check message code rồi gọi `onOrderReady?.()` và `return` sớm — ORDER_READY không qua path toast + sound. Với khách hàng, ORDER_READY chỉ cần toast + âm như mọi thông báo khác. Xóa toàn bộ nhánh đặc biệt.

**Files:**

- Modify: `hooks/use-notification-listener.ts`

- [ ] **Step 1: Replace content**

```ts
/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - Shows toast + plays notification.mp3 (1s) for all message codes including
 *   ORDER_NEEDS_READY_TO_GET — no special alarm for customers
 *
 * Sound lifecycle managed by lib/notification-sound.ts (preloaded at startup).
 */
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

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

export function useNotificationListener(enabled = true) {
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

- [ ] **Step 2: Commit**

```bash
git add hooks/use-notification-listener.ts
git commit -m "refactor(notification): treat ORDER_READY as regular toast for customers"
```

---

## Task 3: Đơn giản hoá useNotificationResponse

**Why:** Hook hiện có nhánh đặc biệt cho ORDER_READY → gọi `onOrderReady` callback và bỏ qua navigation. Sau khi xóa modal, ORDER_READY phải navigate thẳng đến `/order/:id` như mọi notification khác. `getRouteForMessage` đã handle `ORDER_NEEDS_READY_TO_GET` → `/order/${order}` — chỉ cần xóa nhánh đặc biệt.

**Files:**

- Modify: `hooks/use-notification-response.ts`

- [ ] **Step 1: Xóa onOrderReady param + ORDER_READY special path**

Xóa:

- Import `NotificationMessageCode`
- Hàm `parsePayloadMessage`
- Param `onOrderReady`
- Khối `if (code === ORDER_NEEDS_READY_TO_GET && onOrderReady)` trong cả `handleFcmMessage` và `handleExpoResponse`

```ts
/**
 * useNotificationResponse — handle user tapping a notification (background + cold start).
 *
 * Two parallel paths — both needed because FCM notifications from
 * @react-native-firebase/messaging are NOT visible to expo-notifications on Android:
 *
 * Path A — RNFirebase:
 *   - getInitialNotification()  → cold start
 *   - onNotificationOpenedApp() → background tap
 *
 * Path B — expo-notifications (iOS local / in-app alerts):
 *   - addNotificationResponseReceivedListener → background tap
 *   - getLastNotificationResponseAsync        → cold start, guarded by launch-time check
 *
 * All message codes including ORDER_NEEDS_READY_TO_GET navigate via
 * navigateFromNotification — no special modal path for customers.
 */
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { isResponseFromThisSession } from '@/lib/app-launch-time'
import { navigateFromNotification } from '@/lib/notification-navigation'
import { useNotificationStore } from '@/stores/notification.store'

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

export function useNotificationResponse(enabled = true) {
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

      navigateFromNotification(rawData, mode)
    }

    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) handleFcmMessage(remoteMessage, 'cold-start')
      })
      .catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[FCM] getInitialNotification failed:', e),
      )

    const unsubOpened = messaging().onNotificationOpenedApp((rm) =>
      handleFcmMessage(rm, 'background-tap'),
    )

    // ── Path B: expo-notifications ───────────────────────────────────────────

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

      navigateFromNotification(data, mode)
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => handleExpoResponse(response, 'background-tap'),
    )

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
  }, [enabled])
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-notification-response.ts
git commit -m "refactor(notification): remove onOrderReady modal path, ORDER_READY navigates like others"
```

---

## Task 4: Tạo OrderReadyPendingBar

**Why:** Khi khách mở app qua icon (không tap thông báo), không có `onNotificationOpenedApp` hay `getInitialNotification` nào fire — app vào trang chủ bình thường. Không có gì nhắc khách rằng đồ đã sẵn sàng. Component này đọc store realtime, tự xuất hiện khi có ORDER_NEEDS_READY_TO_GET chưa đọc, tự ẩn khi đã đọc.

**Files:**

- Create: `components/notification/order-ready-pending-bar.tsx`

- [ ] **Step 1: Tạo component**

```tsx
import { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { colors } from '@/constants'
import { useNotificationStore } from '@/stores/notification.store'

export function OrderReadyPendingBar() {
  const pending = useNotificationStore((s) =>
    s.notifications.find(
      (n) =>
        !n.isRead &&
        n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
    ),
  )
  const markAsRead = useNotificationStore((s) => s.markAsRead)

  const handleTap = useCallback(() => {
    if (!pending) return
    markAsRead(pending.slug)
    if (pending.metadata.order) {
      router.push(`/order/${pending.metadata.order}`)
    }
  }, [pending, markAsRead])

  const handleDismiss = useCallback(() => {
    if (!pending) return
    markAsRead(pending.slug)
  }, [pending, markAsRead])

  if (!pending) return null

  return (
    <View style={[s.bar, { top: STATIC_TOP_INSET }]}>
      <Pressable
        style={s.content}
        onPress={handleTap}
        android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
      >
        <Text style={s.text} numberOfLines={1}>
          🛎 Đơn của bạn đã sẵn sàng — Lên quầy lấy nhé
        </Text>
      </Pressable>
      <Pressable
        style={s.dismiss}
        onPress={handleDismiss}
        hitSlop={12}
        accessibilityLabel="Đóng thông báo"
      >
        <Text style={s.dismissText}>✕</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.light,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 999,
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 13,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: colors.white.light,
  },
  dismiss: {
    marginLeft: 12,
    padding: 4,
  },
  dismissText: {
    fontSize: 14,
    color: colors.white.light,
    fontFamily: 'BeVietnamPro_400Regular',
  },
})
```

- [ ] **Step 2: Export từ notification components index**

Mở `components/notification/index.ts` (hoặc file barrel tương tự), thêm export:

```ts
export { OrderReadyPendingBar } from './order-ready-pending-bar'
```

Nếu không có barrel file, bỏ qua bước này — import trực tiếp ở Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/notification/order-ready-pending-bar.tsx
git commit -m "feat(notification): add order-ready pending bar for open-via-icon case"
```

---

## Task 5: Wire OrderReadyPendingBar vào tab layout

**Why:** Bar chỉ cần xuất hiện trên tab screens (Home, Menu, Cart, Gift Card, Profile). Không cần trên stack screens vì user đang thao tác với đơn hàng rồi. Tab layout là nơi duy nhất wrap tất cả tab screens.

**Files:**

- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Import và thêm bar vào return**

Tìm phần import ở đầu file, thêm:

```ts
import { OrderReadyPendingBar } from '@/components/notification/order-ready-pending-bar'
```

Tìm phần `return (` trong component, thêm `<OrderReadyPendingBar />` bên cạnh `<ProfileNudgePopup />`:

```tsx
// Trước (cuối return):
  <ProfileNudgePopup />
</View>

// Sau:
  <OrderReadyPendingBar />
  <ProfileNudgePopup />
</View>
```

- [ ] **Step 2: Verify bar không chặn tab header**

`STATIC_TOP_INSET` là chiều cao status bar — bar được đặt ngay dưới status bar, phía trên content của tab screen. Tab screen dùng `paddingTop: STATIC_TOP_INSET` trong header của nó, nên bar overlap lên vùng header tab screen. Kiểm tra bằng cách chạy app và trigger một ORDER_READY notification để xem bar có overlay đúng không.

Nếu bar che mất tab screen header: đổi `top: STATIC_TOP_INSET` thành `top: STATIC_TOP_INSET + 56` (56 là chiều cao TabHeader thông thường) — kiểm tra trong `components/layout/tab-header.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat(notification): wire order-ready pending bar into tab layout"
```

---

## Task 6: Final typecheck + lint

- [ ] **Step 1: Run full check**

```bash
npm run check
```

Fix issues thường gặp:

- `colors.primary.light` — nếu TypeScript báo không tồn tại, kiểm tra `constants/colors.ts` và dùng đúng key. Thay bằng `colors.primary[500]` hoặc `colors.brand.primary` tùy codebase.
- `BeVietnamPro_600SemiBold` — nếu font không tồn tại, dùng `BeVietnamPro_700Bold` thay thế.
- Import path `@/constants/notification.constant` vs `@/constants` — dùng đúng theo codebase hiện tại.

- [ ] **Step 2: Check circular deps**

```bash
npm run check-circular
```

- [ ] **Step 3: Commit fix-up nếu cần**

```bash
git add -p
git commit -m "chore(notification): typecheck cleanup after customer notification flow"
```

---

## Summary

| Vấn đề                                                    | Fix                                             |
| --------------------------------------------------------- | ----------------------------------------------- |
| Modal full-screen alarm khi foreground                    | Task 1+2 — toast nhẹ thay thế                   |
| Modal xuất hiện khi tap thông báo (background/cold-start) | Task 1+3 — navigate thẳng vào /order/:id        |
| Không có nhắc nhở khi mở app qua icon                     | Task 4+5 — persistent bar tự hiện/ẩn theo store |
| `onOrderReady` callback rải rác 3 file                    | Task 1+2+3 — xóa hoàn toàn                      |
