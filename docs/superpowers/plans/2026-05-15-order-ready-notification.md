# Order Ready Notification Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an `order-needs-ready-to-get` notification arrives while the app is in the foreground, replace the small dismissing toast with a prominent non-auto-dismissing modal alert, double sound play, and 3× haptic pulses so customers cannot miss their order is ready.

**Architecture:** A new `OrderReadyAlert` modal component is mounted inside `NotificationProvider`. `useNotificationListener` gains an `onOrderReady` callback param — when the incoming FCM message code is `order-needs-ready-to-get`, it triggers haptic + double sound + calls the callback instead of the normal toast path. `NotificationProvider` holds the pending payload in state, extracts order metadata, renders the modal, and handles navigation on "Xem đơn".

**Tech Stack:** React Native `Modal` (via existing `Dialog` from `@/components/ui`), `expo-haptics`, `expo-av` (already used), `react-i18next`

---

## Files

| Action | Path                                            | Responsibility                                                   |
| ------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| Modify | `i18n/vi/notification.json`                     | Add 5 Vietnamese modal strings                                   |
| Modify | `i18n/en/notification.json`                     | Add 5 English modal strings                                      |
| Create | `components/notification/order-ready-alert.tsx` | Modal UI — title, body, two action buttons                       |
| Modify | `hooks/use-notification-listener.ts`            | Detect order-ready, play haptic×3 + sound×2, call `onOrderReady` |
| Modify | `providers/notification-provider.tsx`           | Hold alert state, pass callback to listener, render modal        |

---

### Task 1: Add i18n strings for the order-ready modal

**Files:**

- Modify: `i18n/vi/notification.json`
- Modify: `i18n/en/notification.json`

- [ ] **Step 1: Add Vietnamese strings**

In `i18n/vi/notification.json`, add after the last `"bodyOrderPaid"` line (before `"enableTitle"`):

```json
  "alertOrderReadyTitle": "Đơn hàng sẵn sàng lấy!",
  "alertOrderReadyBody": "Đơn {{ref}} tại {{branch}} đã sẵn sàng. Vui lòng đến quầy nhận hàng.",
  "alertOrderReadyBodyNoBranch": "Đơn {{ref}} đã sẵn sàng. Vui lòng đến quầy nhận hàng.",
  "alertOrderReadyViewOrder": "Xem đơn",
  "alertOrderReadyClose": "Đóng",
```

Also update `"titleOrderNeedsReadyToGet"` to be more urgent:

```json
  "titleOrderNeedsReadyToGet": "Đơn hàng sẵn sàng lấy!",
```

- [ ] **Step 2: Add English strings**

In `i18n/en/notification.json`, add the same keys after `"bodyOrderPaid"`:

```json
  "alertOrderReadyTitle": "Your order is ready!",
  "alertOrderReadyBody": "Order {{ref}} at {{branch}} is ready. Please collect at the counter.",
  "alertOrderReadyBodyNoBranch": "Order {{ref}} is ready. Please collect at the counter.",
  "alertOrderReadyViewOrder": "View order",
  "alertOrderReadyClose": "Close",
```

Also update:

```json
  "titleOrderNeedsReadyToGet": "Your order is ready!",
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add i18n/vi/notification.json i18n/en/notification.json
git commit -m "feat(notification): add i18n strings for order-ready modal alert"
```

---

### Task 2: Build the OrderReadyAlert modal component

**Files:**

- Create: `components/notification/order-ready-alert.tsx`

**Context:** Use `Dialog` + `Button` from `@/components/ui` — same pattern as `components/dialog/confirmation-dialog.tsx`. The modal must NOT auto-dismiss. The `visible` prop controls open state; only the two buttons can close it.

- [ ] **Step 1: Create the file**

Create `components/notification/order-ready-alert.tsx`:

```tsx
import { ShoppingBag } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { Button, Dialog } from '@/components/ui'
import { colors } from '@/constants'

interface OrderReadyAlertProps {
  visible: boolean
  orderSlug: string | null
  branchName: string
  referenceNumber: string
  isDark: boolean
  onViewOrder: () => void
  onClose: () => void
}

export function OrderReadyAlert({
  visible,
  orderSlug,
  branchName,
  referenceNumber,
  isDark,
  onViewOrder,
  onClose,
}: OrderReadyAlertProps) {
  const { t } = useTranslation('notification')

  const ref = referenceNumber
    ? `#${referenceNumber}`
    : orderSlug
      ? `#${orderSlug}`
      : ''
  const body = branchName
    ? t('alertOrderReadyBody', { ref, branch: branchName })
    : t('alertOrderReadyBodyNoBranch', { ref })

  const iconColor = isDark ? colors.primary[400] : colors.primary[600]
  const bodyColor = isDark ? colors.gray[200] : colors.gray[700]

  return (
    <Dialog open={visible} onOpenChange={() => {}}>
      <Dialog.Content className="max-w-[22rem] rounded-2xl sm:max-w-[32rem]">
        <Dialog.Header>
          <Dialog.Title className="flex flex-row items-center gap-2">
            <ShoppingBag size={20} color={iconColor} />
            <Text style={s.title}>{t('alertOrderReadyTitle')}</Text>
          </Dialog.Title>
          <Dialog.Description>
            <Text style={[s.body, { color: bodyColor }]}>{body}</Text>
          </Dialog.Description>
        </Dialog.Header>

        <Dialog.Footer className="mt-4 flex flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose}>
            {t('alertOrderReadyClose')}
          </Button>
          {orderSlug ? (
            <Button variant="default" onPress={onViewOrder}>
              {t('alertOrderReadyViewOrder')}
            </Button>
          ) : null}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}

const s = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
})
```

- [ ] **Step 2: Export from notification barrel**

Check `components/notification/index.ts` (or `index.tsx`) for the barrel file. If it exists, add:

```ts
export { OrderReadyAlert } from './order-ready-alert'
```

If no barrel exists, skip this step.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/notification/order-ready-alert.tsx
git commit -m "feat(notification): add OrderReadyAlert modal component"
```

---

### Task 3: Update useNotificationListener — haptic × 3 + sound × 2 + callback

**Files:**

- Modify: `hooks/use-notification-listener.ts`

**Context:** The hook currently plays one sound and shows a toast for every notification. For `ORDER_NEEDS_READY_TO_GET` specifically, we need:

1. Haptic feedback × 3 (400ms apart) — uses `expo-haptics` which is already in `package.json`
2. Sound × 2 (1500ms apart) — reuses the existing `playNotificationSound()` helper
3. Call `onOrderReady(payload)` callback instead of toast
4. For all other message types: keep existing toast behavior

The `message` code lives in `payload.data.message` (or inside `payload.data.payload` JSON string — same merge logic as in `notification.store.ts`).

- [ ] **Step 1: Add imports**

At the top of `hooks/use-notification-listener.ts`, add the haptics import after the existing imports:

```ts
import * as Haptics from 'expo-haptics'
import { NotificationMessageCode } from '@/constants/notification.constant'
```

- [ ] **Step 2: Add helper functions after `playNotificationSound`**

After the existing `playNotificationSound` function (around line 71), insert:

```ts
async function playNotificationSoundTwice(): Promise<void> {
  await playNotificationSound()
  await new Promise<void>((r) => setTimeout(r, 1500))
  await playNotificationSound()
}

async function playOrderReadyHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await new Promise<void>((r) => setTimeout(r, 400))
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await new Promise<void>((r) => setTimeout(r, 400))
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  } catch {
    // Haptics unavailable on this device — silent fail
  }
}

function getMessageCode(payload: NotificationPayload): string {
  const data = payload.data ?? {}
  let parsed: Record<string, string> = {}
  if (data.payload && typeof data.payload === 'string') {
    try {
      parsed = JSON.parse(data.payload) as Record<string, string>
    } catch {
      // ignore
    }
  }
  const merged = { ...data, ...parsed }
  return merged.message || data.message || ''
}
```

- [ ] **Step 3: Update the hook signature and handler**

Replace the `useNotificationListener` function signature and the `onMessage` handler body:

```ts
// BEFORE
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
      if (body) showToastInternal(title, body, 'info')

      playNotificationSound().catch(() => {})
    })

    return () => {
      unsubscribe()
      void disposeSound()
    }
  }, [enabled])
}
```

```ts
// AFTER
export function useNotificationListener(
  enabled = true,
  onOrderReady?: (payload: NotificationPayload) => void,
) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const messageCode = getMessageCode(payload)

      if (messageCode === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET) {
        // High-priority alert: haptic × 3 + sound × 2 + modal (no toast)
        playOrderReadyHaptic().catch(() => {})
        playNotificationSoundTwice().catch(() => {})
        onOrderReady?.(payload)
      } else {
        const title = payload.notification?.title || 'Thông báo'
        const body = payload.notification?.body || ''
        if (body) showToastInternal(title, body, 'info')
        playNotificationSound().catch(() => {})
      }
    })

    return () => {
      unsubscribe()
      void disposeSound()
    }
  }, [enabled, onOrderReady])
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-notification-listener.ts
git commit -m "feat(notification): haptic×3 + sound×2 + onOrderReady callback for order-ready notification"
```

---

### Task 4: Wire OrderReadyAlert into NotificationProvider

**Files:**

- Modify: `providers/notification-provider.tsx`

**Context:** `NotificationProvider` already renders `NotificationPermissionSheet`. Add state for the order-ready payload, pass a callback to `useNotificationListener`, extract metadata from the payload, and render `OrderReadyAlert`. On "Xem đơn", navigate to `/payment/<orderSlug>` using `navigateNative.push`.

- [ ] **Step 1: Add imports**

At the top of `providers/notification-provider.tsx`, add:

```ts
import { OrderReadyAlert } from '@/components/notification/order-ready-alert'
import { useColorScheme } from 'react-native'
import { navigateNative } from '@/lib/navigation'
import type { NotificationPayload } from '@/stores/notification.store'
```

- [ ] **Step 2: Add helper to extract order-ready data from payload**

After the imports, before `export function NotificationProvider()`, add:

```ts
interface OrderReadyData {
  orderSlug: string
  branchName: string
  referenceNumber: string
}

function extractOrderReadyData(payload: NotificationPayload): OrderReadyData {
  const data = payload.data ?? {}
  let parsed: Record<string, string> = {}
  if (data.payload && typeof data.payload === 'string') {
    try {
      parsed = JSON.parse(data.payload) as Record<string, string>
    } catch {
      // ignore
    }
  }
  const merged = { ...data, ...parsed }
  return {
    orderSlug: merged.order || '',
    branchName: merged.branchName || '',
    referenceNumber: merged.referenceNumber || merged.order || '',
  }
}
```

- [ ] **Step 3: Add state and callback inside NotificationProvider**

Inside the `NotificationProvider` function body, add after the existing `useRef` / `useState` declarations:

```ts
const colorScheme = useColorScheme()
const isDark = colorScheme === 'dark'

const [orderReadyPayload, setOrderReadyPayload] =
  useState<NotificationPayload | null>(null)

const handleOrderReady = useCallback((payload: NotificationPayload) => {
  setOrderReadyPayload(payload)
}, [])

const handleCloseOrderReady = useCallback(() => {
  setOrderReadyPayload(null)
}, [])

const handleViewOrder = useCallback(() => {
  if (!orderReadyPayload) return
  const { orderSlug } = extractOrderReadyData(orderReadyPayload)
  setOrderReadyPayload(null)
  if (orderSlug) navigateNative.push(`/payment/${orderSlug}`)
}, [orderReadyPayload])
```

- [ ] **Step 4: Pass callback to useNotificationListener**

Change the existing call:

```ts
// BEFORE
useNotificationListener(isAuthenticated)

// AFTER
useNotificationListener(isAuthenticated, handleOrderReady)
```

- [ ] **Step 5: Render OrderReadyAlert in the return**

The current return renders only `<NotificationPermissionSheet>`. Update it:

```tsx
// BEFORE
return (
  <NotificationPermissionSheet
    visible={showPermissionSheet}
    onClose={handleClosePermission}
  />
)

// AFTER
const orderReadyData = orderReadyPayload
  ? extractOrderReadyData(orderReadyPayload)
  : null

return (
  <>
    <NotificationPermissionSheet
      visible={showPermissionSheet}
      onClose={handleClosePermission}
    />
    {orderReadyData && (
      <OrderReadyAlert
        visible={!!orderReadyPayload}
        orderSlug={orderReadyData.orderSlug}
        branchName={orderReadyData.branchName}
        referenceNumber={orderReadyData.referenceNumber}
        isDark={isDark}
        onViewOrder={handleViewOrder}
        onClose={handleCloseOrderReady}
      />
    )}
  </>
)
```

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add providers/notification-provider.tsx
git commit -m "feat(notification): wire OrderReadyAlert into NotificationProvider"
```

---

## Manual test checklist

After all tasks complete, verify on device/simulator:

1. **Foreground + ORDER_NEEDS_READY_TO_GET FCM**: Modal appears (no toast), device vibrates 3×, sound plays twice.
2. **"Xem đơn" button**: Modal closes, app navigates to `/payment/<orderSlug>`.
3. **"Đóng" button**: Modal closes, no navigation.
4. **Other notification types** (e.g. ORDER_PAID): Normal toast appears, single sound, no modal.
5. **Background/killed tap**: Existing behavior unchanged (navigates directly via `navigateFromNotification`).
6. **Dark mode**: Modal renders correctly with dark colors.
