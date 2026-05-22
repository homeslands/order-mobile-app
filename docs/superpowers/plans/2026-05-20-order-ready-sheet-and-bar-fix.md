# Order Ready Pickup Sheet & Ambient Bar Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the X-button dismiss bug on the order-ready bar, rename it to an ambient fallback, and add a prominent `OrderReadyPickupSheet` (bottom sheet) for tab screens.

**Architecture:** Three coordinated changes: (1) harden `addNotification` in the Zustand store so a re-delivered FCM cannot resurrect a read notification; (2) rename `OrderReadyPendingBar` → `OrderReadyAmbientBar` with a fixed sibling-Pressable layout and pathname-based suppression (bar shows only on payment/update-order screens); (3) new `OrderReadyPickupSheet` component using `BottomSheetModal` that shows on tab screens, with session-level dismiss tracking so the sheet does not re-pop after the user soft-dismisses.

**Tech Stack:** React Native, Zustand, `@gorhom/bottom-sheet` (BottomSheetModal), Expo Router `usePathname`, Reanimated, `lucide-react-native`, BeVietnamPro fonts.

---

## File Map

| Action | File |
|--------|------|
| Modify | `stores/notification.store.ts` — harden `addNotification` |
| Create | `__tests__/stores/notification-store-add.test.ts` — unit tests for addNotification |
| Modify | `components/notification/order-ready-pending-bar.tsx` — full rewrite (rename component, fix Pressable, add suppression) |
| Create | `components/notification/order-ready-pickup-sheet.tsx` — new BottomSheetModal |
| Modify | `app/(tabs)/_layout.tsx` — import new sheet, update bar import |

---

### Task 1: Harden `addNotification` to preserve `isRead` on duplicate delivery

**Files:**
- Create: `__tests__/stores/notification-store-add.test.ts`
- Modify: `stores/notification.store.ts:126-140`

- [ ] **Step 1: Write the failing test**

Create `__tests__/stores/notification-store-add.test.ts`:

```ts
// Tests that addNotification does not reset isRead: true on re-delivery.
import { useNotificationStore } from '@/stores/notification.store'

const makePayload = (slug: string, message = 'order-needs-ready-to-get') => ({
  data: { slug, message, order: 'order-1', branchName: 'Test Branch' },
})

beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    markedAllReadAt: null,
  })
})

describe('addNotification', () => {
  it('starts notification as unread by default', () => {
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(false)
    expect(n.slug).toBe('n-1')
  })

  it('preserves isRead: true when the same slug is re-added after markAsRead', () => {
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    useNotificationStore.getState().markAsRead('n-1')
    expect(useNotificationStore.getState().notifications[0].isRead).toBe(true)

    // Simulate FCM re-delivery of the same message
    useNotificationStore.getState().addNotification(makePayload('n-1'))

    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(true)
    expect(useNotificationStore.getState().notifications).toHaveLength(1)
  })

  it('unreadCount stays correct when re-adding a read notification', () => {
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    useNotificationStore.getState().addNotification(makePayload('n-2'))
    useNotificationStore.getState().markAsRead('n-1')
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    // Re-add n-1 — must not increment unreadCount
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    expect(useNotificationStore.getState().unreadCount).toBe(1)
    expect(useNotificationStore.getState().notifications).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/stores/notification-store-add.test.ts --no-coverage
```

Expected: second and third tests FAIL with `expect(received).toBe(expected)` — `isRead` is `false` instead of `true`.

- [ ] **Step 3: Implement the fix in `stores/notification.store.ts`**

Locate the `addNotification` action (lines ~126-140). Replace it:

```ts
addNotification: (payload, options) => {
  set((state) => {
    const rawItem = transformPayloadToNotification(
      payload,
      options?.markAsRead ?? false,
    )
    const existing = state.notifications.find((n) => n.slug === rawItem.slug)
    // Preserve read state: a notification already read locally must not be
    // reset to unread by a duplicate FCM delivery.
    const item =
      existing?.isRead === true ? { ...rawItem, isRead: true } : rawItem
    const filtered = state.notifications.filter((n) => n.slug !== item.slug)
    const updated = [item, ...filtered].slice(0, MAX_NOTIFICATIONS)
    let unreadCount = 0
    for (const n of updated) if (!n.isRead) unreadCount++
    return { notifications: updated, unreadCount }
  })
  syncBadge(get().unreadCount)
},
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/stores/notification-store-add.test.ts --no-coverage
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add stores/notification.store.ts __tests__/stores/notification-store-add.test.ts
git commit -m "fix(notification): preserve isRead when re-adding duplicate FCM notification"
```

---

### Task 2: Rename and fix `OrderReadyAmbientBar`

**Files:**
- Modify: `components/notification/order-ready-pending-bar.tsx` — full replacement (rename component + fix Pressable + add pathname suppression)

The bug: the X `<Pressable>` is nested inside the bar `<Pressable>`, causing both `handleDismiss` AND `handleBarPress` to fire when the user taps X on some React Native versions/platforms. The fix: make the X Pressable a **sibling**, not a child.

The rename: component is now `OrderReadyAmbientBar` (bar only shows as fallback on payment/update-order screens where the sheet is suppressed).

The pathname suppression: bar is visible only when `pathname` starts with `/payment/` or `/update-order/`.

- [ ] **Step 1: Replace the full file content**

Replace the entire contents of `components/notification/order-ready-pending-bar.tsx` with:

```tsx
/**
 * OrderReadyAmbientBar — fallback ambient bar for payment/update-order screens.
 *
 * On tab screens OrderReadyPickupSheet handles ORDER_NEEDS_READY_TO_GET.
 * This bar shows only when the user is mid-payment and the sheet is suppressed,
 * so they still get a non-blocking nudge without the full sheet overlay.
 *
 * Layout: outer Animated.View → inner View (flexRow) → [Pressable tapArea | Pressable X]
 * Sibling Pressables prevent tap-propagation bug where nested Pressable fired
 * both handleDismiss and handleBarPress simultaneously.
 *
 * Tap tapArea → markAsRead + navigate to order detail
 * Tap X       → markAsRead + toast hint (no navigation)
 */
import * as Haptics from 'expo-haptics'
import { usePathname } from 'expo-router'
import { X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import { TAB_HEADER_CONTENT_HEIGHT } from '@/components/layout/tab-header'
import { colors } from '@/constants'
import { NotificationMessageCode } from '@/constants/notification.constant'
import { TIMING_CONFIGS } from '@/constants/motion'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'
import { showToastInternal } from '@/providers/toast-provider'
import { useNotificationStore } from '@/stores/notification.store'

const BAR_TOP = STATIC_TOP_INSET + TAB_HEADER_CONTENT_HEIGHT

export const OrderReadyAmbientBar = memo(function OrderReadyAmbientBar() {
  const pathname = usePathname()
  const { pendingSlug, pendingOrderSlug } = useNotificationStore(
    useShallow((s) => {
      const n = s.notifications.find(
        (n) =>
          !n.isRead &&
          n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      )
      return {
        pendingSlug: n?.slug ?? null,
        pendingOrderSlug: n?.metadata.order ?? null,
      }
    }),
  )

  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const isDark = useColorScheme() === 'dark'

  // Bar is the fallback for payment/update-order screens only.
  // Tab screens get OrderReadyPickupSheet instead.
  const isPaymentRoute =
    pathname?.startsWith('/payment/') || pathname?.startsWith('/update-order/')

  const visible = pendingSlug !== null && isPaymentRoute

  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-40)
  const hapticFiredForSlug = useRef<string | null>(null)

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, TIMING_CONFIGS.bannerSlide)
      translateY.value = withTiming(0, TIMING_CONFIGS.bannerSlide)
      if (pendingSlug !== hapticFiredForSlug.current) {
        hapticFiredForSlug.current = pendingSlug
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {})
      }
    } else {
      hapticFiredForSlug.current = null
      opacity.value = withTiming(0, TIMING_CONFIGS.bannerSlide)
      translateY.value = withTiming(-40, TIMING_CONFIGS.bannerSlide)
    }
  }, [visible, pendingSlug, opacity, translateY])

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
    showToastInternal(
      'Đã ẩn nhắc nhở',
      'Đã ẩn nhắc nhở — Xem lại ở mục Thông báo',
      'info',
    )
  }, [pendingSlug, markAsRead])

  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const textColor = colors.white.light

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[s.wrapper, { top: BAR_TOP }, animatedStyle]}
    >
      <View style={[s.bar, { backgroundColor: primaryColor }]}>
        {/* tapArea: full-width minus the close button, no nesting */}
        <Pressable
          style={s.tapArea}
          onPress={handleBarPress}
          accessibilityRole="button"
          accessibilityLabel="Đơn hàng đã sẵn sàng — Nhấn để xem chi tiết"
        >
          <Text style={[s.message, { color: textColor }]} numberOfLines={1}>
            Đơn đã sẵn sàng — nhận ngay 🎉
          </Text>
        </Pressable>
        {/* Sibling, not child — prevents propagation to tapArea */}
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          style={s.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo"
        >
          <X size={16} color={textColor} />
        </Pressable>
      </View>
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
  },
  tapArea: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 4,
  },
  message: {
    fontSize: 13,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: error on `app/(tabs)/_layout.tsx` — `OrderReadyPendingBar` no longer exported. We'll fix that in Task 4.

- [ ] **Step 3: Commit (staged only — _layout.tsx fix comes in Task 4)**

```bash
git add components/notification/order-ready-pending-bar.tsx
git commit -m "fix(notification): rename bar to AmbientBar, fix Pressable sibling layout, add pathname suppression"
```

---

### Task 3: Create `OrderReadyPickupSheet`

**Files:**
- Create: `components/notification/order-ready-pickup-sheet.tsx`

The sheet presents when:
- Store has an unread `ORDER_NEEDS_READY_TO_GET` notification
- Current pathname is NOT `/payment/`, `/update-order/`, or `/order/`
- The notification slug has NOT been dismissed in this app session

Dismiss behaviors:
- "Xem chi tiết đơn" → `markAsRead` + `navigateNative.push` + add to `dismissedInSession`
- "Để sau" → `markAsRead` + toast + add to `dismissedInSession`
- Swipe down or scrim tap → soft-dismiss (add to `dismissedInSession`, no `markAsRead`, bell badge stays)

`dismissedInSession` is a module-level `Set<string>` — cleared only when the JS runtime restarts (app kill). This prevents re-presenting within a session while preserving fresh-start behavior.

- [ ] **Step 1: Create the file**

Create `components/notification/order-ready-pickup-sheet.tsx`:

```tsx
/**
 * OrderReadyPickupSheet — prominent bottom sheet notifying the customer that
 * their order is ready for pickup.
 *
 * Show conditions (all must be true):
 * - Unread ORDER_NEEDS_READY_TO_GET notification exists in store
 * - Pathname is NOT /payment/, /update-order/, or /order/ (payment screens get
 *   OrderReadyAmbientBar instead; order-detail is already showing the order)
 * - Notification slug NOT in dismissedInSession (Set cleared on app kill only)
 *
 * Dismiss behaviors:
 * - "Xem chi tiết đơn" → markAsRead + navigate + add to dismissedInSession
 * - "Để sau"           → markAsRead + toast  + add to dismissedInSession
 * - Swipe / scrim      → soft-dismiss (add to dismissedInSession, no markAsRead)
 *
 * isProgrammaticDismissRef prevents onDismiss from double-adding to
 * dismissedInSession when dismiss() is called from a button handler.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { usePathname } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { colors } from '@/constants'
import { NotificationMessageCode } from '@/constants/notification.constant'
import { navigateNative } from '@/lib/navigation'
import { showToastInternal } from '@/providers/toast-provider'
import { useNotificationStore } from '@/stores/notification.store'

const SNAP_POINTS = ['45%']

// Module-level: persists for JS runtime lifetime (cleared only on app kill).
const dismissedInSession = new Set<string>()

interface PendingOrder {
  slug: string
  orderSlug: string
  referenceNumber: string
  branchName: string
}

export const OrderReadyPickupSheet = memo(function OrderReadyPickupSheet() {
  const pathname = usePathname()
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

  const pendingOrder = useNotificationStore(
    useShallow((s): PendingOrder | null => {
      const n = s.notifications.find(
        (n) =>
          !n.isRead &&
          n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      )
      if (!n) return null
      return {
        slug: n.slug,
        orderSlug: n.metadata.order,
        referenceNumber: n.metadata.referenceNumber ?? '',
        branchName: n.metadata.branchName,
      }
    }),
  )

  const markAsRead = useNotificationStore((s) => s.markAsRead)

  const shouldSuppress =
    pathname?.startsWith('/payment/') ||
    pathname?.startsWith('/update-order/') ||
    pathname?.startsWith('/order/')

  const sheetRef = useRef<BottomSheetModal>(null)
  // Slug currently shown (or last shown) — prevents re-presenting same slug.
  const shownSlugRef = useRef<string | null>(null)
  // True when we call dismiss() programmatically — prevents onDismiss from
  // treating a button-triggered dismiss as a user swipe/scrim.
  const isProgrammaticDismissRef = useRef(false)
  // Mirror of pendingOrder for onDismiss (avoids stale closure).
  const pendingOrderRef = useRef<PendingOrder | null>(null)
  useEffect(() => {
    pendingOrderRef.current = pendingOrder
  }, [pendingOrder])

  // Present / dismiss reactively.
  useEffect(() => {
    const shouldShow =
      !!pendingOrder &&
      !shouldSuppress &&
      !dismissedInSession.has(pendingOrder.slug)

    if (shouldShow && shownSlugRef.current !== pendingOrder!.slug) {
      shownSlugRef.current = pendingOrder!.slug
      sheetRef.current?.present()
    } else if (!shouldShow) {
      isProgrammaticDismissRef.current = true
      sheetRef.current?.dismiss()
    }
  }, [pendingOrder, shouldSuppress])

  // onDismiss: called after sheet fully closes (any cause).
  const handleSheetDismiss = useCallback(() => {
    if (!isProgrammaticDismissRef.current && pendingOrderRef.current) {
      // User-initiated: swipe down or scrim tap — soft dismiss, no markAsRead.
      dismissedInSession.add(pendingOrderRef.current.slug)
    }
    isProgrammaticDismissRef.current = false
    shownSlugRef.current = null
  }, [])

  const handleViewOrder = useCallback(() => {
    if (!pendingOrder) return
    dismissedInSession.add(pendingOrder.slug)
    markAsRead(pendingOrder.slug)
    isProgrammaticDismissRef.current = true
    sheetRef.current?.dismiss()
    if (pendingOrder.orderSlug) {
      navigateNative.push(`/order/${pendingOrder.orderSlug}`)
    }
  }, [pendingOrder, markAsRead])

  const handleDismissLater = useCallback(() => {
    if (!pendingOrder) return
    dismissedInSession.add(pendingOrder.slug)
    markAsRead(pendingOrder.slug)
    isProgrammaticDismissRef.current = true
    sheetRef.current?.dismiss()
    showToastInternal(
      'Đã ẩn nhắc nhở',
      'Đã ẩn nhắc nhở — Xem lại ở mục Thông báo',
      'info',
    )
  }, [pendingOrder, markAsRead])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  )

  const bgStyle = useMemo(
    () => ({
      backgroundColor: isDark ? colors.card.dark : colors.white.light,
    }),
    [isDark],
  )

  const successColor = isDark ? colors.success.dark : colors.success.light
  const iconBg = isDark
    ? colors.success.iconBgDark
    : colors.success.iconBgLight
  const titleColor = isDark ? colors.gray[50] : colors.gray[900]
  const bodyColor = isDark ? colors.gray[400] : colors.gray[500]
  const primaryBg = isDark ? colors.primary.dark : colors.primary.light
  const secondaryBg = isDark ? colors.border.dark : colors.gray[100]
  const secondaryText = isDark ? colors.gray[50] : colors.gray[700]

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={handleSheetDismiss}
    >
      <View style={[s.content, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.body}>
          <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
            <CheckCircle2 size={32} color={successColor} />
          </View>

          <Text style={[s.title, { color: titleColor }]}>
            Đơn của bạn đã sẵn sàng!
          </Text>

          {!!pendingOrder?.referenceNumber && (
            <Text style={[s.orderInfo, { color: bodyColor }]}>
              Đơn #{pendingOrder.referenceNumber}
              {pendingOrder.branchName ? ` • ${pendingOrder.branchName}` : ''}
            </Text>
          )}

          <Text style={[s.hint, { color: bodyColor }]}>
            Vui lòng đến quầy để nhận đơn của bạn
          </Text>
        </View>

        <View style={s.footer}>
          <Pressable
            onPress={handleDismissLater}
            style={[s.btn, { backgroundColor: secondaryBg }]}
            accessibilityRole="button"
          >
            <Text style={[s.btnText, { color: secondaryText }]}>Để sau</Text>
          </Pressable>

          <Pressable
            onPress={handleViewOrder}
            style={[s.btn, { backgroundColor: primaryBg }]}
            accessibilityRole="button"
          >
            <Text style={[s.btnText, { color: colors.white.light }]}>
              Xem chi tiết đơn
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: 'BeVietnamPro_700Bold',
    textAlign: 'center',
  },
  orderInfo: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_600SemiBold',
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
})
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors in the new file (it is not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add components/notification/order-ready-pickup-sheet.tsx
git commit -m "feat(notification): add OrderReadyPickupSheet bottom sheet for order-ready flow"
```

---

### Task 4: Wire up in `(tabs)/_layout.tsx`

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

Update the import from `OrderReadyPendingBar` → `OrderReadyAmbientBar` and add `OrderReadyPickupSheet`.

- [ ] **Step 1: Update the import line**

Locate line 28 in `app/(tabs)/_layout.tsx`:
```ts
import { OrderReadyPendingBar } from '@/components/notification/order-ready-pending-bar'
```

Replace with:
```ts
import { OrderReadyAmbientBar } from '@/components/notification/order-ready-pending-bar'
import { OrderReadyPickupSheet } from '@/components/notification/order-ready-pickup-sheet'
```

- [ ] **Step 2: Update the JSX — add sheet, rename bar**

Locate lines 459-460 in `app/(tabs)/_layout.tsx`:
```tsx
      <OrderReadyPendingBar />
      <ProfileNudgePopup />
```

Replace with:
```tsx
      <OrderReadyPickupSheet />
      <OrderReadyAmbientBar />
      <ProfileNudgePopup />
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass (including the 3 new notification-store-add tests).

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git commit -m "feat(notification): wire up OrderReadyPickupSheet and OrderReadyAmbientBar in tabs layout"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Bug fix: nested Pressable → sibling layout in `OrderReadyAmbientBar` (Task 2)
- ✅ Store hardening: `addNotification` preserves `isRead` (Task 1)
- ✅ Bottom sheet: `OrderReadyPickupSheet` with `BottomSheetModal` (Task 3)
- ✅ Pathname suppression on bar (only shows on payment/update-order) (Task 2)
- ✅ Pathname suppression on sheet (suppressed on payment/update-order/order routes) (Task 3)
- ✅ Session-level dismiss tracking via `dismissedInSession` Set (Task 3)
- ✅ Dismiss behaviors: "Xem chi tiết" = navigate + markAsRead, "Để sau" = markAsRead + toast, scrim = soft (Task 3)
- ✅ Haptic on ambient bar appearance (carried over, Task 2)
- ✅ Layout wired up (Task 4)

**Placeholder scan:** None found.

**Type consistency:**
- `OrderReadyAmbientBar` exported from `order-ready-pending-bar.tsx` (keeping filename to minimize git diff noise)
- `OrderReadyPickupSheet` exported from `order-ready-pickup-sheet.tsx`
- `PendingOrder` interface defined and used only in Task 3
- `dismissedInSession: Set<string>` module-level in sheet file only
- `pendingOrderRef` mirrors `pendingOrder` for use in `onDismiss` callback — consistent throughout Task 3
