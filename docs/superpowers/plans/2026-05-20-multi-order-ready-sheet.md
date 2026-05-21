# Multi-Order Ready Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent-dismiss logic in `OrderReadyPickupSheet` with a FIFO queue + 90-second snooze, and add a pending-order badge when multiple orders are ready.

**Architecture:** Extract all queue/snooze logic into a new `useOrderReadyQueue` hook; the component becomes a thin renderer that calls the hook and shows a pulsing badge when `pendingCount > 1`. Module-level `snoozeMap` persists across re-renders without a store; a `forceUpdate` call inside `snooze()` and `suppressFor()` ensures immediate re-derivation of `activeOrder`.

**Tech Stack:** React Native, Zustand (`useNotificationStore`), React hooks, `react-native-reanimated` (pulsing dot), `@gorhom/bottom-sheet` (`BottomSheetModal`), Jest + `@testing-library/react-native`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/use-order-ready-queue.ts` | **Create** | All queue/snooze logic — FIFO sort, snoozeMap, forceUpdate, suppressFor |
| `components/notification/order-ready-pickup-sheet.tsx` | **Rewrite** | Pure renderer — consume hook, show pending badge, handle button/swipe |
| `__tests__/hooks/use-order-ready-queue.test.ts` | **Create** | Unit tests for hook (FIFO, snooze, markDone, suppress, pendingCount) |

No other files change. `stores/notification.store.ts` already has `markAllReadByOrder`.

---

## Task 1: `useOrderReadyQueue` hook

**Files:**
- Create: `hooks/use-order-ready-queue.ts`
- Create: `__tests__/hooks/use-order-ready-queue.test.ts`

### Background for the implementer

The existing `OrderReadyPickupSheet` stores dismissed notification slugs in a module-level `Set` (`dismissedInSession`) — once dismissed, they never re-appear. We need snooze-and-re-show behavior instead.

Key types (from `@/types/notification.type.ts`):
```ts
interface INotification {
  slug: string           // unique notification id
  createdAt: string      // ISO timestamp
  message: string        // e.g. 'order-needs-ready-to-get'
  isRead: boolean
  metadata: {
    order: string          // order slug (shared across duplicate FCMs for same order)
    referenceNumber?: string
    branchName: string
    // ... other fields we don't use here
  }
}
```

`NotificationMessageCode.ORDER_NEEDS_READY_TO_GET = 'order-needs-ready-to-get'` (from `@/constants/notification.constant`).

`useNotificationStore` is a Zustand store. Usage:
```ts
// Subscribe to a slice:
const value = useNotificationStore(selector)
// Subscribe with shallow equality (for objects/arrays):
const value = useNotificationStore(useShallow(selector))
// Read state without subscribing (in callbacks):
useNotificationStore.getState().someAction()
```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/hooks/use-order-ready-queue.test.ts` with this content:

```ts
import { act, renderHook } from '@testing-library/react-native'

// ─── Shared mutable store state ──────────────────────────────────────────────
const storeState = {
  notifications: [] as Array<{
    slug: string
    createdAt: string
    message: string
    isRead: boolean
    metadata: {
      order: string
      referenceNumber?: string
      branchName: string
    }
  }>,
  markAllReadByOrder: jest.fn(),
}

jest.mock('@/stores/notification.store', () => ({
  useNotificationStore: jest.fn((selector: (s: typeof storeState) => unknown) =>
    typeof selector === 'function' ? selector(storeState) : storeState,
  ),
}))

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}))

// Import AFTER mocks (Jest hoisting)
import { useOrderReadyQueue } from '@/hooks/use-order-ready-queue'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNotif(overrides: {
  slug?: string
  orderSlug?: string
  createdAt?: string
  referenceNumber?: string
  branchName?: string
}) {
  return {
    slug: overrides.slug ?? `notif-${Math.random()}`,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    message: 'order-needs-ready-to-get',
    isRead: false,
    metadata: {
      order: overrides.orderSlug ?? `order-${Math.random()}`,
      referenceNumber: overrides.referenceNumber ?? 'REF-001',
      branchName: overrides.branchName ?? 'Q1',
    },
  }
}

beforeEach(() => {
  storeState.notifications = []
  storeState.markAllReadByOrder.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useOrderReadyQueue', () => {
  test('returns null activeOrder when no notifications', () => {
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })

  test('returns oldest notification first (FIFO)', () => {
    const older = makeNotif({ orderSlug: 'order-old', createdAt: '2026-01-01T10:00:00.000Z' })
    const newer = makeNotif({ orderSlug: 'order-new', createdAt: '2026-01-01T11:00:00.000Z' })
    storeState.notifications = [newer, older] // store prepends newest first
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-old')
  })

  test('pendingCount includes snoozed orders', () => {
    const n1 = makeNotif({ orderSlug: 'order-1' })
    const n2 = makeNotif({ orderSlug: 'order-2' })
    storeState.notifications = [n1, n2]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.pendingCount).toBe(2)
    act(() => { result.current.snooze('order-1') })
    // pendingCount stays 2 — snoozed is still "pending"
    expect(result.current.pendingCount).toBe(2)
    // but activeOrder shifts to order-2
    expect(result.current.activeOrder?.orderSlug).toBe('order-2')
  })

  test('snooze hides the active order and promotes the next one', () => {
    const n1 = makeNotif({ orderSlug: 'order-1', createdAt: '2026-01-01T10:00:00.000Z' })
    const n2 = makeNotif({ orderSlug: 'order-2', createdAt: '2026-01-01T11:00:00.000Z' })
    storeState.notifications = [n1, n2]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-1')
    act(() => { result.current.snooze('order-1') })
    expect(result.current.activeOrder?.orderSlug).toBe('order-2')
  })

  test('snoozed order re-appears after SNOOZE_MS (90s)', () => {
    const n1 = makeNotif({ orderSlug: 'order-solo' })
    storeState.notifications = [n1]
    const { result } = renderHook(() => useOrderReadyQueue())
    act(() => { result.current.snooze('order-solo') })
    expect(result.current.activeOrder).toBeNull()
    // Advance past 90s snooze + 10s interval tick
    act(() => { jest.advanceTimersByTime(100_000) })
    expect(result.current.activeOrder?.orderSlug).toBe('order-solo')
  })

  test('markDone calls markAllReadByOrder and removes from active queue', () => {
    const n1 = makeNotif({ orderSlug: 'order-done' })
    storeState.notifications = [n1]
    const { result } = renderHook(() => useOrderReadyQueue())
    act(() => { result.current.markDone('order-done') })
    expect(storeState.markAllReadByOrder).toHaveBeenCalledWith('order-done')
  })

  test('suppressFor blocks activeOrder for given duration then re-enables', () => {
    const n1 = makeNotif({ orderSlug: 'order-suppressed' })
    storeState.notifications = [n1]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-suppressed')
    act(() => { result.current.suppressFor(600) })
    expect(result.current.activeOrder).toBeNull()
    act(() => { jest.advanceTimersByTime(700) })
    expect(result.current.activeOrder?.orderSlug).toBe('order-suppressed')
  })

  test('ignores isRead notifications', () => {
    storeState.notifications = [{
      slug: 'read-notif',
      createdAt: new Date().toISOString(),
      message: 'order-needs-ready-to-get',
      isRead: true,
      metadata: { order: 'order-read', referenceNumber: 'REF', branchName: 'Q1' },
    }]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })

  test('ignores non-ORDER_NEEDS_READY_TO_GET notifications', () => {
    storeState.notifications = [{
      slug: 'other-notif',
      createdAt: new Date().toISOString(),
      message: 'order-paid',
      isRead: false,
      metadata: { order: 'order-other', referenceNumber: 'REF', branchName: 'Q1' },
    }]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/hooks/use-order-ready-queue.test.ts --no-coverage
```

Expected: All tests FAIL with "Cannot find module '@/hooks/use-order-ready-queue'"

- [ ] **Step 3: Implement `useOrderReadyQueue`**

Create `hooks/use-order-ready-queue.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'

export interface PendingOrder {
  orderSlug: string
  referenceNumber: string
  branchName: string
}

export interface OrderReadyQueue {
  activeOrder: PendingOrder | null
  pendingCount: number
  snooze: (orderSlug: string) => void
  markDone: (orderSlug: string) => void
  suppressFor: (ms: number) => void
}

// Module-level: persists for JS runtime lifetime (cleared only on app kill).
const snoozeMap = new Map<string, number>() // orderSlug → expireAt ms
const SNOOZE_MS = 90_000

function isSnoozing(orderSlug: string): boolean {
  const exp = snoozeMap.get(orderSlug)
  if (!exp) return false
  if (Date.now() >= exp) {
    snoozeMap.delete(orderSlug)
    return false
  }
  return true
}

export function useOrderReadyQueue(): OrderReadyQueue {
  const notifications = useNotificationStore(
    useShallow((s) =>
      s.notifications.filter(
        (n) =>
          !n.isRead &&
          n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      ),
    ),
  )
  const markAllReadByOrder = useNotificationStore((s) => s.markAllReadByOrder)

  const [, forceUpdate] = useState(0)
  const suppressUntilRef = useRef(0)

  // Re-check snooze expiry every 10s so expired orders re-surface.
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  // Sort ASC by createdAt → oldest notification surfaces first (FIFO).
  const sorted = [...notifications].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const isSuppressed = Date.now() < suppressUntilRef.current
  const activeNotif = isSuppressed
    ? null
    : (sorted.find((n) => !isSnoozing(n.metadata.order)) ?? null)

  const activeOrder: PendingOrder | null = activeNotif
    ? {
        orderSlug: activeNotif.metadata.order,
        referenceNumber: activeNotif.metadata.referenceNumber ?? '',
        branchName: activeNotif.metadata.branchName,
      }
    : null

  const pendingCount = sorted.length

  const snooze = useCallback(
    (orderSlug: string) => {
      snoozeMap.set(orderSlug, Date.now() + SNOOZE_MS)
      // Immediately re-derive activeOrder so the effect in the consumer
      // sees the updated value synchronously (prevents re-present flicker).
      forceUpdate((n) => n + 1)
    },
    [forceUpdate],
  )

  const markDone = useCallback(
    (orderSlug: string) => {
      snoozeMap.delete(orderSlug)
      markAllReadByOrder(orderSlug)
    },
    [markAllReadByOrder],
  )

  const suppressFor = useCallback(
    (ms: number) => {
      suppressUntilRef.current = Date.now() + ms
      // Re-derive activeOrder immediately (suppressed) and again after expiry.
      forceUpdate((n) => n + 1)
      setTimeout(() => forceUpdate((n) => n + 1), ms + 50)
    },
    [forceUpdate],
  )

  return { activeOrder, pendingCount, snooze, markDone, suppressFor }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/hooks/use-order-ready-queue.test.ts --no-coverage
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-order-ready-queue.ts __tests__/hooks/use-order-ready-queue.test.ts
git commit -m "feat(notification): add useOrderReadyQueue hook with FIFO + snooze"
```

---

## Task 2: Rewrite `OrderReadyPickupSheet`

**Files:**
- Modify: `components/notification/order-ready-pickup-sheet.tsx` (full rewrite)

### Background for the implementer

The current component manages queue state inline (module-level `dismissedInSession` Set, refs, `dismissAllByOrder` helper). All of that moves to `useOrderReadyQueue` (Task 1). The component becomes a thin renderer.

Key changes from current:
- `dismissedInSession` Set → removed (handled by `snoozeMap` in hook)
- `isProgrammaticDismissRef` → renamed `isProgrammaticRef`, same role
- `pendingOrderRef` → `activeOrderRef` (synced from hook's `activeOrder`)
- `dismissAllByOrder` helper → removed; replaced with `snooze(orderSlug)` from hook
- `markAllReadByOrder` subscription → removed; replaced with `markDone(orderSlug)` from hook
- `shownSlugRef` tracks `orderSlug` (not notification slug) — prevents re-present when duplicate FCM arrives for same order
- Toast message changes: `'Sẽ nhắc lại sau 90 giây · Xem ở Thông báo'`
- New: pending badge between handle and icon (pulsing dot + "Còn N-1 đơn nữa")
- Pulsing dot uses `react-native-reanimated` (`withRepeat` + `withSequence`)

`PendingOrder` type is now imported from `@/hooks/use-order-ready-queue` (defined there in Task 1).

Colors available in `@/constants`:
- `colors.success.dark` / `colors.success.light` — green checkmark color
- `colors.success.iconBgDark` / `colors.success.iconBgLight` — icon background
- `colors.gray[50]`, `colors.gray[400]`, `colors.gray[500]`, `colors.gray[900]`
- `colors.primary.dark` / `colors.primary.light` — primary button background
- `colors.border.dark` / `colors.gray[100]` — secondary button background
- `colors.white.light` — white

- [ ] **Step 1: Rewrite the component**

Replace the entire content of `components/notification/order-ready-pickup-sheet.tsx`:

```tsx
/**
 * OrderReadyPickupSheet — prominent bottom sheet notifying the customer that
 * their order is ready for pickup.
 *
 * Show conditions (all must be true):
 * - useOrderReadyQueue returns a non-null activeOrder
 * - Pathname is NOT /order/ (order-detail is already showing the order)
 *
 * Dismiss behaviors:
 * - "Xem chi tiết đơn" → markDone + navigate + suppressFor(600ms)
 * - "Để sau"           → snooze(90s) + toast
 * - Swipe / scrim      → snooze(90s)  [no markAsRead — stays unread in list]
 *
 * Pending badge: if pendingCount > 1, shows "Còn N-1 đơn nữa đang chờ"
 * with a pulsing Reanimated dot between the handle and the icon.
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { useOrderReadyQueue, type PendingOrder } from '@/hooks/use-order-ready-queue'
import { navigateNative } from '@/lib/navigation'
import { showToastInternal } from '@/providers/toast-provider'

const SNAP_POINTS = ['45%']

export const OrderReadyPickupSheet = memo(function OrderReadyPickupSheet() {
  const pathname = usePathname()
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

  const { activeOrder, pendingCount, snooze, markDone, suppressFor } =
    useOrderReadyQueue()

  const shouldSuppress = pathname?.startsWith('/order/')

  const sheetRef = useRef<BottomSheetModal>(null)
  // Tracks by orderSlug — prevents re-present when duplicate FCM arrives.
  const shownOrderRef = useRef<string | null>(null)
  const isProgrammaticRef = useRef(false)
  // Ref so handleSheetDismiss can read latest activeOrder without stale closure.
  const activeOrderRef = useRef<PendingOrder | null>(null)
  useEffect(() => {
    activeOrderRef.current = activeOrder
  }, [activeOrder])

  useEffect(() => {
    const shouldShow = !!activeOrder && !shouldSuppress

    if (shouldShow && shownOrderRef.current !== activeOrder.orderSlug) {
      shownOrderRef.current = activeOrder.orderSlug
      requestAnimationFrame(() => sheetRef.current?.present())
    } else if (!shouldShow && shownOrderRef.current !== null) {
      isProgrammaticRef.current = true
      sheetRef.current?.dismiss()
    }
  }, [activeOrder, shouldSuppress])

  const handleSheetDismiss = useCallback(() => {
    if (!isProgrammaticRef.current && activeOrderRef.current) {
      snooze(activeOrderRef.current.orderSlug)
    }
    isProgrammaticRef.current = false
    shownOrderRef.current = null
  }, [snooze])

  const handleViewOrder = useCallback(() => {
    if (!activeOrder) return
    markDone(activeOrder.orderSlug)
    suppressFor(600)
    isProgrammaticRef.current = true
    sheetRef.current?.dismiss()
    navigateNative.push(`/order/${activeOrder.orderSlug}`)
  }, [activeOrder, markDone, suppressFor])

  const handleDismissLater = useCallback(() => {
    if (!activeOrder) return
    snooze(activeOrder.orderSlug)
    isProgrammaticRef.current = true
    sheetRef.current?.dismiss()
    showToastInternal(
      'Đã ẩn nhắc nhở',
      'Sẽ nhắc lại sau 90 giây · Xem ở Thông báo',
      'info',
    )
  }, [activeOrder, snooze])

  // Pulsing dot for pending badge — runs on UI thread via Reanimated.
  const dotOpacity = useSharedValue(1)
  useEffect(() => {
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 750 }),
        withTiming(1, { duration: 750 }),
      ),
      -1,
    )
  }, [dotOpacity])
  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }))

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
  const iconBg = isDark ? colors.success.iconBgDark : colors.success.iconBgLight
  const titleColor = isDark ? colors.gray[50] : colors.gray[900]
  const bodyColor = isDark ? colors.gray[400] : colors.gray[500]
  const primaryBg = isDark ? colors.primary.dark : colors.primary.light
  const secondaryBg = isDark ? colors.border.dark : colors.gray[100]
  const secondaryText = isDark ? colors.gray[50] : colors.gray[700]
  const badgeBg = isDark ? 'rgba(232,184,75,0.12)' : 'rgba(232,184,75,0.10)'
  const badgeText = isDark ? '#E8B84B' : '#966c00'

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
          {pendingCount > 1 && (
            <View
              style={[
                s.pendingBadge,
                { backgroundColor: badgeBg, borderColor: 'rgba(232,184,75,0.35)' },
              ]}
            >
              <Animated.View style={[s.pendingDot, animatedDotStyle]} />
              <Text style={[s.pendingText, { color: badgeText }]}>
                Còn {pendingCount - 1} đơn nữa đang chờ
              </Text>
            </View>
          )}

          <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
            <CheckCircle2 size={32} color={successColor} />
          </View>

          <Text style={[s.title, { color: titleColor }]}>
            Đơn của bạn đã sẵn sàng!
          </Text>

          {!!activeOrder?.referenceNumber && (
            <Text style={[s.orderInfo, { color: bodyColor }]}>
              Đơn #{activeOrder.referenceNumber}
              {activeOrder.branchName ? ` • ${activeOrder.branchName}` : ''}
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
            accessibilityLabel="Ẩn thông báo"
          >
            <Text style={[s.btnText, { color: secondaryText }]}>Để sau</Text>
          </Pressable>

          <Pressable
            onPress={handleViewOrder}
            style={[s.btn, { backgroundColor: primaryBg }]}
            accessibilityRole="button"
            accessibilityLabel="Xem chi tiết đơn"
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
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8B84B',
  },
  pendingText: {
    fontSize: 12,
    fontFamily: 'BeVietnamPro_600SemiBold',
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

Expected: Exit 0, no errors. If there are errors about `colors.success.iconBgDark` or similar, check `constants/index.ts` for the exact key names and fix the property access to match.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: Exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add components/notification/order-ready-pickup-sheet.tsx
git commit -m "feat(notification): rewrite OrderReadyPickupSheet with FIFO queue and snooze"
```

---

## Manual Smoke Test (after both tasks)

In Metro/Flipper console, trigger test notifications:

```js
// Single order
global.__devTriggerOrderReady({ referenceNumber: 'A001', orderSlug: 'order-a', branchName: 'Q1' })

// Second order (wait 2s then run)
global.__devTriggerOrderReady({ referenceNumber: 'B002', orderSlug: 'order-b', branchName: 'Q1' })
```

Verify:
- [ ] Sheet for A001 appears, badge "Còn 1 đơn nữa đang chờ" with pulsing dot
- [ ] Pressing "Để sau" → sheet closes, toast "Sẽ nhắc lại sau 90 giây", notification stays unread
- [ ] After ~90s, A001 sheet re-appears
- [ ] Pressing "Xem chi tiết đơn" on A001 → navigate to order detail, B002 sheet appears on back
- [ ] Swipe down → snooze behavior (same as "Để sau"), no markAsRead
