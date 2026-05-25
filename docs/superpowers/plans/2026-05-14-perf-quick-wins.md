# Performance Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 isolated performance and stability issues identified in the post-optimization audit: Error Boundary, cold-start flicker, history cache correctness, notification badge debounce, effect dep narrowing, hero image navigation, payment focus storm, home banner memory, and cart O(1) lookup.

**Architecture:** Each task is self-contained and can be reviewed independently. Tasks 1–6 are < 30 min each. Tasks 7–9 are 45–90 min each. No task depends on another. C1 (mirror pattern removal from order-flow.store) is intentionally excluded — it is a larger architectural refactor planned separately.

**Tech Stack:** Zustand, React Native + Expo, React 19, FlashList v2, TanStack React Query, Reanimated 4.

---

## Task 1 — Error Boundary (C6: production stability)

**Why:** The app has no top-level React error boundary. Any uncaught render error in a child tree (e.g. malformed API response, divide-by-zero in a selector) currently crashes the entire JS surface to a white/black screen. Wrapping the root in a class-based boundary catches the error, shows a fallback UI, and lets the user retry without re-launching the app.

**Files:**

- Create: `components/ui/app-error-boundary.tsx`
- Modify: `app/_layout.tsx`

### Steps

- [ ] **1.1** Create `/Users/phanquyetthang/mobile-movie-app/components/ui/app-error-boundary.tsx` with the following content:

```tsx
import React from 'react'
import { Pressable, Text, View } from 'react-native'

import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'

interface AppErrorBoundaryProps {
  children: React.ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level React error boundary. Catches uncaught render errors anywhere
 * in the tree and shows a recoverable fallback UI instead of crashing the
 * entire JS surface.
 *
 * Must be a class component — hooks cannot implement `componentDidCatch`.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface to dev console; production would forward to Sentry/Crashlytics.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[AppErrorBoundary]', error, info.componentStack)
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            paddingTop: STATIC_TOP_INSET + 24,
            paddingHorizontal: 24,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background.light,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              marginBottom: 8,
              color: colors.foreground.light,
              textAlign: 'center',
            }}
          >
            Đã xảy ra lỗi
          </Text>
          <Text
            style={{
              fontSize: 14,
              marginBottom: 24,
              color: colors.mutedForeground.light,
              textAlign: 'center',
            }}
          >
            Vui lòng thử lại. Nếu lỗi tiếp tục xuất hiện, hãy khởi động lại ứng
            dụng.
          </Text>
          <Pressable
            onPress={this.handleReset}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              backgroundColor: colors.primary.light,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Thử lại</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
```

- [ ] **1.2** In `/Users/phanquyetthang/mobile-movie-app/app/_layout.tsx`, add the import near the other `components/...` imports:

```ts
import { AppErrorBoundary } from '@/components/ui/app-error-boundary'
```

- [ ] **1.3** In the same file, wrap the existing provider tree. Find the JSX returned by the inner layout component (the `<GestureHandlerRootView>` … `</GestureHandlerRootView>` block) and wrap it with `<AppErrorBoundary>`:

```tsx
return (
  <AppErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <LogoutSheetPortal />
            <QRSelectionSheet />
            <ScanSheetPortal />
            <NotificationProvider />
            <I18nProvider>
              <NavigationEngineProvider>
                <MasterTransitionProvider>
                  <AppToastProvider>
                    <SharedElementProvider>
                      <NativeStackWithMasterTransition />
                    </SharedElementProvider>
                  </AppToastProvider>
                </MasterTransitionProvider>
              </NavigationEngineProvider>
            </I18nProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  </AppErrorBoundary>
)
```

- [ ] **1.4** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **1.5** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add components/ui/app-error-boundary.tsx app/_layout.tsx && git commit -m "feat(stability): add top-level AppErrorBoundary to catch uncaught render errors"
```

---

## Task 2 — Fix `onRehydrateStorage` setTimeout (C2: cold-start flicker)

**Why:** `useOrderFlowStore`'s `onRehydrateStorage` currently schedules `setState` via `setTimeout(..., 0)`. On cold start, this means `isHydrated`, `orderItemTotalQuantity`, and `minOrderValue` are read as default `false / 0 / 0` for one paint, then flip on the next macrotask — visible as a 1-frame flicker on the cart badge and "minimum order" UI. Zustand's `onRehydrateStorage` callback receives a mutable `state` object; mutating it inline applies before the first render and removes the flicker. We still defer the cross-store sync (`paymentData`, `updatingData`) to `setTimeout` because those reads can hit unhydrated standalone stores.

**Files:**

- Modify: `stores/order-flow.store.ts`

### Steps

- [ ] **2.1** In `/Users/phanquyetthang/mobile-movie-app/stores/order-flow.store.ts`, locate the `onRehydrateStorage` block at lines ~770–790 and replace it. Current code:

```ts
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Set hydrated flag + derive orderItemTotalQuantity, minOrderValue (khong persist)
          const items = state.orderingData?.orderItems
          const total = calcOrderItemTotalQuantity(items)
          const minVal = calcMinOrderValue(items)
          setTimeout(() => {
            // Sync paymentData and updatingData from standalone stores after hydration
            const paymentData = usePaymentFlowStore.getState().paymentData
            const updatingData = useUpdateOrderFlowStore.getState().updatingData
            useOrderFlowStore.setState({
              isHydrated: true,
              orderItemTotalQuantity: total,
              minOrderValue: minVal,
              paymentData,
              updatingData,
            })
            useCartDisplayStore
              .getState()
              .setRawSubTotal(calcRawSubTotal(items ?? []))
          }, 0)
        }
      },
```

Replace with:

```ts
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // Derive non-persisted fields INLINE on the rehydrated state object so
        // they apply before the first paint — eliminates the 1-frame flicker
        // where badge/min-order render with default 0 values.
        const items = state.orderingData?.orderItems
        state.isHydrated = true
        state.orderItemTotalQuantity = calcOrderItemTotalQuantity(items)
        state.minOrderValue = calcMinOrderValue(items)

        // Cross-store sync still goes through setTimeout — payment/update
        // standalone stores may not be hydrated yet on this tick.
        setTimeout(() => {
          const paymentData = usePaymentFlowStore.getState().paymentData
          const updatingData = useUpdateOrderFlowStore.getState().updatingData
          useOrderFlowStore.setState({ paymentData, updatingData })
          useCartDisplayStore
            .getState()
            .setRawSubTotal(calcRawSubTotal(items ?? []))
        }, 0)
      },
```

- [ ] **2.2** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **2.3** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/order-flow.store.ts && git commit -m "fix(order-flow): apply rehydrated state inline to remove cold-start flicker"
```

---

## Task 3 — Fix history cache: include userSlug, clear on logout (C4)

**Why:** `app/profile/history.tsx` keeps a module-level `_orderDisplayCache` keyed by `(orderSlug, status, itemCount, voucher.slug)`. If User A logs out and User B logs in, B's orders that happen to share an `orderSlug` would hit A's cached display data (different totals after voucher recalc, etc.). Two fixes: namespace the cache key with `userSlug`, and clear the cache on logout so the module-level Map doesn't retain another account's data across sessions.

**Files:**

- Modify: `app/profile/history.tsx`
- Modify: `app/(tabs)/profile/index.tsx`

### Steps

- [ ] **3.1** In `/Users/phanquyetthang/mobile-movie-app/app/profile/history.tsx`, locate the cache declaration at lines ~58–61 and add an exported clear function. Current code:

```ts
// ─── Module-level FIFO cache for order display data ─────────────────────────
// Keyed by (slug, status, itemCount, voucher.slug). Lives outside the component
// so it survives re-renders. Capped at 50 entries (FIFO eviction).
const _orderDisplayCache = new Map<string, OrderDisplayData>()
```

Replace with:

```ts
// ─── Module-level FIFO cache for order display data ─────────────────────────
// Keyed by (userSlug, slug, status, itemCount, voucher.slug). Lives outside
// the component so it survives re-renders. Capped at 50 entries (FIFO).
// userSlug is in the key to prevent leakage across accounts on the same device.
const _orderDisplayCache = new Map<string, OrderDisplayData>()

/**
 * Clear the entire order display cache. Call on logout so cached display data
 * for the previous account does not leak into the next session.
 */
export function clearOrderDisplayCache(): void {
  _orderDisplayCache.clear()
}
```

- [ ] **3.2** In the same file, locate the `useMemo` at lines ~480–510. Inside the component (search for the existing `const userInfo = useUserStore(...)` reference, or add a fresh subscription if missing). Add a `userSlug` selector before the `useMemo` if not already present:

```ts
const userSlug = useUserStore((s) => s.userInfo?.slug ?? '')
```

Then update the `useMemo` to include `userSlug` in the cache key and dependency array. Current code:

```ts
// Cache keyed by (slug, status, itemCount, voucher.slug) so FCM-triggered
// refetches do not redo work for unchanged orders.
const orderDisplayMap = useMemo(() => {
  const next = new Map<string, OrderDisplayData>()
  for (const order of orders) {
    const items = order.orderItems || []
    const voucher = order.voucher || null
    const cacheKey = `${order.slug}:${order.status}:${items.length}:${voucher?.slug ?? ''}`
    const cached = _orderDisplayCache.get(cacheKey)
    if (cached) {
      next.set(order.slug, cached)
      continue
    }
    const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
      items,
      voucher,
    )
    const diMap = new Map<string, (typeof displayItems)[number]>()
    for (const di of displayItems) diMap.set(di.slug, di)
    const data: OrderDisplayData = { displayItemMap: diMap, cartTotals }
    next.set(order.slug, data)
    _orderDisplayCache.set(cacheKey, data)
  }
  if (_orderDisplayCache.size > 50) {
    const keys = Array.from(_orderDisplayCache.keys())
    keys.slice(0, keys.length - 50).forEach((k) => _orderDisplayCache.delete(k))
  }
  return next
}, [orders])
```

Replace with:

```ts
// Cache keyed by (userSlug, slug, status, itemCount, voucher.slug) so
// FCM-triggered refetches do not redo work AND data from a previous
// account on the same device cannot leak into the current session.
const orderDisplayMap = useMemo(() => {
  const next = new Map<string, OrderDisplayData>()
  for (const order of orders) {
    const items = order.orderItems || []
    const voucher = order.voucher || null
    const cacheKey = `${userSlug}:${order.slug}:${order.status}:${items.length}:${voucher?.slug ?? ''}`
    const cached = _orderDisplayCache.get(cacheKey)
    if (cached) {
      next.set(order.slug, cached)
      continue
    }
    const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
      items,
      voucher,
    )
    const diMap = new Map<string, (typeof displayItems)[number]>()
    for (const di of displayItems) diMap.set(di.slug, di)
    const data: OrderDisplayData = { displayItemMap: diMap, cartTotals }
    next.set(order.slug, data)
    _orderDisplayCache.set(cacheKey, data)
  }
  if (_orderDisplayCache.size > 50) {
    const keys = Array.from(_orderDisplayCache.keys())
    keys.slice(0, keys.length - 50).forEach((k) => _orderDisplayCache.delete(k))
  }
  return next
}, [orders, userSlug])
```

- [ ] **3.3** In `/Users/phanquyetthang/mobile-movie-app/app/(tabs)/profile/index.tsx`, add the import near the other `@/...` imports:

```ts
import { clearOrderDisplayCache } from '@/app/profile/history'
```

- [ ] **3.4** In the same file, locate `handleLogoutConfirm` (around line 570) and call `clearOrderDisplayCache()` right before `clearAll()`. Current code:

```ts
const handleLogoutConfirm = useCallback(() => {
  // Capture token BEFORE removeUserInfo() clears it — avoids race condition
  // where cleanupTokenOnLogout() reads null and skips server unregister
  const capturedToken = useUserStore.getState().deviceToken
  import('@/lib/fcm-token-manager').then((m) => {
    m.cleanupTokenOnLogout(capturedToken ?? undefined).catch(() => {})
  })
  // Clear notification store so next login starts with a clean slate
  useNotificationStore.getState().clearAll()
  setLogout()
  removeUserInfo()
  router.replace('/(tabs)/home' as never)
  showToast(tToast('logoutSuccess', 'Đăng xuất thành công'))
}, [removeUserInfo, setLogout, tToast, router])
```

Replace with:

```ts
const handleLogoutConfirm = useCallback(() => {
  // Capture token BEFORE removeUserInfo() clears it — avoids race condition
  // where cleanupTokenOnLogout() reads null and skips server unregister
  const capturedToken = useUserStore.getState().deviceToken
  import('@/lib/fcm-token-manager').then((m) => {
    m.cleanupTokenOnLogout(capturedToken ?? undefined).catch(() => {})
  })
  // Clear notification store and module-level history cache so the next
  // login starts with a clean slate (no cross-account data leakage).
  useNotificationStore.getState().clearAll()
  clearOrderDisplayCache()
  setLogout()
  removeUserInfo()
  router.replace('/(tabs)/home' as never)
  showToast(tToast('logoutSuccess', 'Đăng xuất thành công'))
}, [removeUserInfo, setLogout, tToast, router])
```

- [ ] **3.5** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **3.6** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add app/profile/history.tsx "app/(tabs)/profile/index.tsx" && git commit -m "fix(history): namespace order display cache by userSlug and clear on logout"
```

---

## Task 4 — Debounce `syncBadge` in notification store (H2)

**Why:** `syncBadge` is called inside almost every mutating action (`addNotification`, `markAsRead`, `markAllAsRead`, `setReadStates`, `clearAll`). When FCM delivers a burst (`hydrateFromApi` followed by bulk read updates), `Notifications.setBadgeCountAsync` fires several times in <50ms. Each call is a native bridge round-trip. Debouncing to a 200ms trailing window collapses the burst into a single native call while keeping the visible badge eventually-consistent.

**Files:**

- Modify: `stores/notification.store.ts`

### Steps

- [ ] **4.1** In `/Users/phanquyetthang/mobile-movie-app/stores/notification.store.ts`, locate the `syncBadge` helper (lines ~100–104). Current code:

```ts
// ─── Helpers (continued) ────────────────────────────────────────────────────

function syncBadge(count: number): void {
  Notifications.setBadgeCountAsync(count).catch(() => {})
}
```

Replace with:

```ts
// ─── Helpers (continued) ────────────────────────────────────────────────────

// Debounced badge sync — collapses bursts (e.g. FCM hydrate + bulk mark-read)
// into a single native call. 200ms trailing window: imperceptible to the user,
// eliminates redundant bridge round-trips.
let _badgeTimer: ReturnType<typeof setTimeout> | null = null
let _pendingBadgeCount = 0

function syncBadge(count: number): void {
  _pendingBadgeCount = count
  if (_badgeTimer) return
  _badgeTimer = setTimeout(() => {
    _badgeTimer = null
    Notifications.setBadgeCountAsync(_pendingBadgeCount).catch(() => {})
  }, 200)
}
```

- [ ] **4.2** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **4.3** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/notification.store.ts && git commit -m "perf(notifications): debounce setBadgeCountAsync to collapse burst updates"
```

---

## Task 5 — Narrow `bootstrapNotifData` effect dep (H3)

**Why:** In `app/(tabs)/_layout.tsx`, the bootstrap-notifications effect depends on `[bootstrapNotifData]`. React Query produces a new wrapper object on every refetch even when `result.items` is identical, so this effect (which calls `useNotificationStore.getState().hydrateFromApi`) re-runs on every poll and causes redundant Map rebuilds inside `hydrateFromApi`. Narrowing the dep to `[bootstrapNotifData?.result?.items]` ties re-runs to actual list-reference changes (React Query keeps the inner array stable when contents are unchanged via `structuralSharing`).

**Files:**

- Modify: `app/(tabs)/_layout.tsx`

### Steps

- [ ] **5.1** In `/Users/phanquyetthang/mobile-movie-app/app/(tabs)/_layout.tsx`, locate the effect at lines ~71–77. Current code:

```ts
useEffect(() => {
  const items = bootstrapNotifData?.result?.items
  if (items && items.length > 0) {
    useNotificationStore.getState().hydrateFromApi(items)
  }
}, [bootstrapNotifData])
```

Replace with:

```ts
// Narrow dep to the actual array reference — React Query produces a new
// wrapper object on every refetch even when contents are identical, so
// depending on `bootstrapNotifData` would re-run hydrateFromApi on every
// poll. structuralSharing keeps items stable when unchanged.
const bootstrapNotifItems = bootstrapNotifData?.result?.items
useEffect(() => {
  if (bootstrapNotifItems && bootstrapNotifItems.length > 0) {
    useNotificationStore.getState().hydrateFromApi(bootstrapNotifItems)
  }
}, [bootstrapNotifItems])
```

- [ ] **5.2** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **5.3** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add "app/(tabs)/_layout.tsx" && git commit -m "perf(notifications): narrow bootstrap effect dep to items array reference"
```

---

## Task 6 — Replace `JSON.stringify`/`parse` with ephemeral store for hero images (H4)

**Why:** When navigating from menu → product detail, the menu currently stringifies `selectedItem.heroImageUrls` into a route param, and the product detail re-parses it with `JSON.parse` inside a `useMemo`. Stringify cost is O(images) and the parsed array allocates a fresh array reference on every mount, which is wasted work for a piece of data already in memory. Replace with a tiny in-memory Zustand store that the menu writes before `router.push` and the detail reads via `getState()`. Same lifetime as the route param (single transition) but zero serialization.

**Files:**

- Create: `stores/transient-nav.store.ts`
- Modify: `app/(tabs)/menu/index.tsx`
- Modify: `app/(tabs)/menu/product/[id].tsx`

### Steps

- [ ] **6.1** Create `/Users/phanquyetthang/mobile-movie-app/stores/transient-nav.store.ts`:

```ts
/**
 * Transient navigation store — short-lived in-memory payload for screen
 * transitions, used in place of stringifying large props into route params.
 *
 * - NO persistence (purely RAM-local).
 * - Producer (e.g. menu) writes via `setHeroImageUrls` immediately before
 *   `router.push(...)`.
 * - Consumer (e.g. product detail) reads via `useTransientNavStore.getState()`
 *   on mount. Reading via getState() avoids subscribing to changes.
 */
import { create } from 'zustand'

interface TransientNavStore {
  heroImageUrls: string[]
  setHeroImageUrls: (urls: string[]) => void
  clearHeroImageUrls: () => void
}

export const useTransientNavStore = create<TransientNavStore>((set) => ({
  heroImageUrls: [],
  setHeroImageUrls: (urls) => set({ heroImageUrls: urls }),
  clearHeroImageUrls: () => set({ heroImageUrls: [] }),
}))
```

- [ ] **6.2** In `/Users/phanquyetthang/mobile-movie-app/app/(tabs)/menu/index.tsx`, add the import near the other `@/stores/...` imports:

```ts
import { useTransientNavStore } from '@/stores/transient-nav.store'
```

- [ ] **6.3** In the same file, locate `handleOpenDetail` at lines ~498–516. Current code:

```ts
const handleOpenDetail = useCallback(
  (itemId: string) => {
    const selectedItem = itemsMapRef.current.get(itemId)
    if (!selectedItem) return

    router.push({
      pathname: '/(tabs)/menu/product/[id]',
      params: {
        id: selectedItem.id,
        name: selectedItem.name,
        basePrice: String(selectedItem.rawPrice),
        promotionValue: String(selectedItem.promotionValue),
        imageUrl: selectedItem.imageUrl ?? '',
        imageUrls: JSON.stringify(selectedItem.heroImageUrls),
      },
    })
  },
  [router],
)
```

Replace with:

```ts
const handleOpenDetail = useCallback(
  (itemId: string) => {
    const selectedItem = itemsMapRef.current.get(itemId)
    if (!selectedItem) return

    // Hand hero image URLs via in-memory store instead of stringifying
    // through route params — same transition lifetime, zero serialization.
    useTransientNavStore
      .getState()
      .setHeroImageUrls(selectedItem.heroImageUrls ?? [])

    router.push({
      pathname: '/(tabs)/menu/product/[id]',
      params: {
        id: selectedItem.id,
        name: selectedItem.name,
        basePrice: String(selectedItem.rawPrice),
        promotionValue: String(selectedItem.promotionValue),
        imageUrl: selectedItem.imageUrl ?? '',
      },
    })
  },
  [router],
)
```

- [ ] **6.4** In `/Users/phanquyetthang/mobile-movie-app/app/(tabs)/menu/product/[id].tsx`, add the import near the other `@/stores/...` imports:

```ts
import { useTransientNavStore } from '@/stores/transient-nav.store'
```

- [ ] **6.5** In the same file, locate the params destructure and the `heroImageUrls` `useMemo` at lines ~98–132. Current code:

```ts
const { id, name, basePrice, promotionValue, imageUrl, imageUrls } =
  useLocalSearchParams<{
    id: string
    name?: string
    basePrice?: string
    promotionValue?: string
    imageUrl?: string
    imageUrls?: string
  }>()
```

Replace with:

```ts
const { id, name, basePrice, promotionValue, imageUrl } = useLocalSearchParams<{
  id: string
  name?: string
  basePrice?: string
  promotionValue?: string
  imageUrl?: string
}>()
```

- [ ] **6.6** In the same file, replace the `useMemo` block that parses `imageUrls`. Current code:

```ts
const heroImageUrls = useMemo(() => {
  if (!imageUrls) return []
  try {
    const parsed = JSON.parse(imageUrls) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is string => typeof v === 'string' && !!v.trim(),
    )
  } catch {
    return []
  }
}, [imageUrls])
```

Replace with:

```ts
// Read once on mount from the transient nav store — set by the menu screen
// immediately before router.push. Avoids stringifying a string[] into a
// route param and re-parsing on the destination.
const heroImageUrls = useMemo(
  () => useTransientNavStore.getState().heroImageUrls,
  [],
)
```

- [ ] **6.7** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **6.8** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/transient-nav.store.ts "app/(tabs)/menu/index.tsx" "app/(tabs)/menu/product/[id].tsx" && git commit -m "perf(menu): pass hero images via in-memory store instead of JSON-stringified route param"
```

---

## Task 7 — Merge payment screen focus effects (C3)

**Why:** `app/payment/[order].tsx` has three separate `useFocusEffect` calls (lines ~796, ~803, ~829) that fire on every focus event: one refetches order, one clears `ExpoImage` memory cache on blur, one refetches coin balance + loyalty. On a focus→blur→focus storm (e.g. swiping back from a half-opened sheet) this triggers 3 network calls and a memory-cache flush per cycle. Merge into a single effect that (a) tracks the last fetch timestamp via a ref, (b) skips refetch if <30s have elapsed, (c) only clears `ExpoImage` memory cache on blur when the order is in a terminal success state (PAID / COMPLETED — keeping the QR image cached while PENDING).

**Files:**

- Modify: `app/payment/[order].tsx`

### Steps

- [ ] **7.1** In `/Users/phanquyetthang/mobile-movie-app/app/payment/[order].tsx`, locate the three `useFocusEffect` calls at lines ~793–840. Current code:

```ts
// Refetch when screen regains focus — catches background FCM that didn't go through store
useFocusEffect(
  useCallback(() => {
    void refetchOrder()
  }, [refetchOrder]),
)

// Clear image memory cache on blur (QR code + product images)
useFocusEffect(
  useCallback(() => {
    return () => {
      queueMicrotask(() => ExpoImage.clearMemoryCache())
    }
  }, []),
)

// ── Payment method selection + submission ──
const userInfo = useUserStore((s) => s.userInfo)
const isLoggedIn = !!userInfo

// Coin balance — chỉ fetch khi logged in + order PENDING
const { balance: coinBalance, refetch: refetchCoinBalance } =
  useCoinBalance(isLoggedIn)

// Loyalty points — chỉ fetch khi logged in + order PENDING
const loyaltyData = useLoyaltyPoints(
  order?.status === OrderStatus.PENDING && isLoggedIn
    ? (userInfo?.slug ?? undefined)
    : undefined,
)
const userTotalPoints = loyaltyData.data?.totalPoints ?? 0
const refetchLoyalty = loyaltyData.refetch

// Refetch coin balance + loyalty points on screen focus to get fresh data
useFocusEffect(
  useCallback(() => {
    if (isLoggedIn) {
      void refetchCoinBalance()
      void refetchLoyalty()
    }
  }, [isLoggedIn, refetchCoinBalance, refetchLoyalty]),
)
```

Replace with (keeping the `userInfo`/`isLoggedIn`/coin/loyalty hook declarations in the same order — only the three `useFocusEffect` calls are merged):

```ts
// ── Payment method selection + submission ──
const userInfo = useUserStore((s) => s.userInfo)
const isLoggedIn = !!userInfo

// Coin balance — chỉ fetch khi logged in + order PENDING
const { balance: coinBalance, refetch: refetchCoinBalance } =
  useCoinBalance(isLoggedIn)

// Loyalty points — chỉ fetch khi logged in + order PENDING
const loyaltyData = useLoyaltyPoints(
  order?.status === OrderStatus.PENDING && isLoggedIn
    ? (userInfo?.slug ?? undefined)
    : undefined,
)
const userTotalPoints = loyaltyData.data?.totalPoints ?? 0
const refetchLoyalty = loyaltyData.refetch

// ── Merged focus effect ───────────────────────────────────────────────────
// Replaces 3 separate useFocusEffect calls. On focus:
//   - Refetch order + (if logged in) coin balance + loyalty points, but
//     only if last fetch was > 30s ago — prevents refetch storms on
//     rapid focus→blur→focus cycles (e.g. half-opened sheets).
// On blur:
//   - Clear ExpoImage memory cache ONLY when the order is in a terminal
//     success state. While PENDING, we want the QR code to stay warm.
const lastFocusFetchAtRef = useRef(0)
const FOCUS_REFETCH_INTERVAL_MS = 30_000

useFocusEffect(
  useCallback(() => {
    const now = Date.now()
    if (now - lastFocusFetchAtRef.current > FOCUS_REFETCH_INTERVAL_MS) {
      lastFocusFetchAtRef.current = now
      void refetchOrder()
      if (isLoggedIn) {
        void refetchCoinBalance()
        void refetchLoyalty()
      }
    }
    return () => {
      // Only flush image memory cache when the order is no longer pending —
      // keeps the QR image hot while the user is mid-payment.
      const status = order?.status
      if (status === OrderStatus.COMPLETED || status === OrderStatus.PAID) {
        queueMicrotask(() => ExpoImage.clearMemoryCache())
      }
    }
  }, [
    refetchOrder,
    refetchCoinBalance,
    refetchLoyalty,
    isLoggedIn,
    order?.status,
  ]),
)
```

Note: If `OrderStatus.PAID` does not exist in the enum, drop that arm and use only `OrderStatus.COMPLETED`. Verify by grepping `constants/...` or `types/...` for `OrderStatus` definition before the verify step. If neither PAID nor SUCCESS exists, keep just `=== OrderStatus.COMPLETED`.

- [ ] **7.2** Verify `OrderStatus` enum members. If `PAID` is not defined, edit the condition to drop the `|| status === OrderStatus.PAID` arm:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -n "PAID\|COMPLETED\|SUCCESS" types/order.type.ts 2>/dev/null | head -20
```

- [ ] **7.3** If the previous grep showed PAID is not present, simplify the blur arm to:

```ts
if (status === OrderStatus.COMPLETED) {
  queueMicrotask(() => ExpoImage.clearMemoryCache())
}
```

- [ ] **7.4** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **7.5** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add "app/payment/[order].tsx" && git commit -m "perf(payment): merge 3 focus effects into one with 30s throttle and gated cache flush"
```

---

## Task 8 — Migrate home banner from `FlatList` to `FlashList`, drop data triplication (C5)

**Why:** The home banner (`components/home/swipper-banner.tsx`) uses `FlatList` with a manually triplicated array `[last, ...bannerData, first]` to fake infinite scroll. The triplication doubles memory for image refs and makes `getItemLayout` brittle (renders depend on synthetic indices). FlashList v2 (already in `package.json`) recycles views correctly with no `getItemLayout` and is faster on horizontal paged content. We can also drop the triplication: the snap-back-to-real-index approach works with a single array as long as we let the user reach the visual edge and snap back on `onMomentumScrollEnd`. The dot indicator stays mapped to the real index. Net win: half the rendered cells, FlashList's native recycling, no `infiniteIndexRef`.

**Files:**

- Modify: `components/home/swipper-banner.tsx`

### Steps

- [ ] **8.1** In `/Users/phanquyetthang/mobile-movie-app/components/home/swipper-banner.tsx`, update the imports. Current code:

```ts
import { Image } from 'expo-image'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
```

Replace with:

```ts
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { Image } from 'expo-image'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, Linking, Pressable, StyleSheet, View } from 'react-native'
```

(Note: `useMemo` is no longer needed once `infiniteData` is removed. If other call sites in the file still use `useMemo`, keep it.)

- [ ] **8.2** In the same file, locate the component body starting at line ~140. Current code (lines ~140–160):

```ts
  height: slideHeight,
}: SwiperBannerProps): React.ReactElement | null {
  const flatListRef = useRef<FlatList>(null)
  const count = bannerData.length

  /**
   * Infinite scroll — clone last at front, first at back:
   *   [last, item0, item1, ..., itemN, first]
   */
  const infiniteData = useMemo(() => {
    if (count <= 1) return bannerData
    return [bannerData[count - 1], ...bannerData, bannerData[0]]
  }, [bannerData, count])

  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const infiniteIndexRef = useRef(1)

  useEffect(() => {
    if (count <= 1) return
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({ index: 1, animated: false })
    })
  }, [count])
```

Replace with:

```ts
  height: slideHeight,
}: SwiperBannerProps): React.ReactElement | null {
  const listRef = useRef<FlashListRef<IBanner>>(null)
  const count = bannerData.length

  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
```

- [ ] **8.3** In the same file, locate the auto-scroll effect (lines ~163–168). Current code:

```ts
    }, AUTO_SCROLL_INTERVAL)
    return () => clearInterval(interval)
  }, [count])
```

(And the surrounding effect — search for `AUTO_SCROLL_INTERVAL` in the file; the effect uses `infiniteIndexRef`. Replace its body to use a single-array circular advance.)

The full auto-scroll `useEffect` (find by `AUTO_SCROLL_INTERVAL`) should be replaced with:

```ts
useEffect(() => {
  if (count <= 1) return
  const interval = setInterval(() => {
    const nextIndex = (activeIndexRef.current + 1) % count
    activeIndexRef.current = nextIndex
    setActiveIndex(nextIndex)
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true })
  }, AUTO_SCROLL_INTERVAL)
  return () => clearInterval(interval)
}, [count])
```

- [ ] **8.4** Replace `handleScrollEnd` with the FlashList-friendly handler that does NOT rely on triplication. Current code:

```ts
const handleScrollEnd = useCallback(
  (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (count <= 1) return
    const rawIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)

    if (rawIndex === 0) {
      flatListRef.current?.scrollToIndex({ index: count, animated: false })
      infiniteIndexRef.current = count
      activeIndexRef.current = count - 1
      setActiveIndex(count - 1)
      return
    }
    if (rawIndex === count + 1) {
      flatListRef.current?.scrollToIndex({ index: 1, animated: false })
      infiniteIndexRef.current = 1
      activeIndexRef.current = 0
      setActiveIndex(0)
      return
    }

    const realIndex = rawIndex - 1
    infiniteIndexRef.current = rawIndex
    activeIndexRef.current = realIndex
    setActiveIndex(realIndex)
  },
  [count],
)
```

Replace with:

```ts
const handleScrollEnd = useCallback(
  (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (count <= 1) return
    const rawIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
    // Single-array circular paging: index is always in [0, count).
    // FlashList handles recycling without the triplication trick.
    const clamped = Math.max(0, Math.min(count - 1, rawIndex))
    activeIndexRef.current = clamped
    setActiveIndex(clamped)
  },
  [count],
)
```

- [ ] **8.5** Remove the obsolete `getItemLayout` callback (FlashList does not use it) and update the render. Current code (lines ~238–267):

```ts
  return (
    <View style={{ width: '100%', height: slideHeight }}>
      <FlatList
        ref={flatListRef}
        data={infiniteData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={() => {}}
        removeClippedSubviews
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={3}
      />

      {count > 1 && (
        <View style={s.dots}>
          {bannerData.map((_, i) => (
            <BannerDot key={i} isActive={i === activeIndex} />
          ))}
        </View>
      )}
    </View>
  )
})
```

Replace with:

```ts
  return (
    <View style={{ width: '100%', height: slideHeight }}>
      <FlashList
        ref={listRef}
        data={bannerData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        estimatedItemSize={SCREEN_W}
      />

      {count > 1 && (
        <View style={s.dots}>
          {bannerData.map((_, i) => (
            <BannerDot key={i} isActive={i === activeIndex} />
          ))}
        </View>
      )}
    </View>
  )
})
```

- [ ] **8.6** Delete the now-unused `getItemLayout` callback in the file (search for `const getItemLayout` and remove the block):

```ts
const getItemLayout = useCallback(
  (_: unknown, index: number) => ({
    length: SCREEN_W,
    offset: SCREEN_W * index,
    index,
  }),
  [],
)
```

(Remove entirely. No replacement.)

- [ ] **8.7** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **8.8** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add components/home/swipper-banner.tsx && git commit -m "perf(home): migrate banner from FlatList to FlashList and drop data triplication"
```

---

## Task 9 — Add `orderItemsById` Map for O(1) cart selector (H6)

**Why:** `useCartItemQuantity(itemId)` currently does `orderItems.find(i => i.id === itemId)` — O(n) per selector call, and it runs once per cell in the cart list on every store change. For a cart of 20 items this is 400 comparisons per re-render. Maintain a derived `orderItemsById: Record<string, IOrderItem>` updated in lockstep with `orderItems`, and switch the selector to `s.orderItemsById[itemId]?.quantity ?? 0` — O(1) lookup, zero allocation per cell.

**Files:**

- Modify: `stores/order-flow.types.ts`
- Modify: `stores/order-flow.store.ts`
- Modify: `stores/slices/ordering-items.slice.ts`
- Modify: `stores/cart.store.ts`

### Steps

- [ ] **9.1** In `/Users/phanquyetthang/mobile-movie-app/stores/order-flow.types.ts`, locate the `IOrderFlowStore` interface (line ~62) and add the `orderItemsById` field plus a derivation helper. Find the existing fields:

```ts
export interface IOrderFlowStore {
  ...
  orderItemTotalQuantity: number
  minOrderValue: number
```

Add a new field right after `minOrderValue: number`:

```ts
orderItemTotalQuantity: number
minOrderValue: number
/** O(1) lookup map derived from orderingData.orderItems. Not persisted. */
orderItemsById: Record<string, IOrderItem>
```

(Ensure `IOrderItem` is imported in this file — it should already be since the file references `orderItems: IOrderItem[]`. If not, add to imports.)

- [ ] **9.2** In the same file, near the existing `calcOrderItemTotalQuantity` / `calcMinOrderValue` helpers (search for `export function calcOrderItemTotalQuantity`), append a new helper:

```ts
/** Build an id → IOrderItem map. Returns empty object for undefined/empty input. */
export function calcOrderItemsById(
  items: IOrderItem[] | undefined,
): Record<string, IOrderItem> {
  if (!items || items.length === 0) return {}
  const out: Record<string, IOrderItem> = {}
  for (const it of items) {
    if (it.id) out[it.id] = it
  }
  return out
}
```

- [ ] **9.3** In `/Users/phanquyetthang/mobile-movie-app/stores/order-flow.store.ts`, add `calcOrderItemsById` to the import from `./order-flow.types` near line 19:

```ts
import {
  calcMinOrderValue,
  calcOrderItemTotalQuantity,
  calcOrderItemsById,
  calcRawSubTotal,
  generateOrderId,
  generateOrderItemId,
  OrderFlowStep,
  type IOrderFlowStore,
  type IOrderingData,
} from './order-flow.types'
```

- [ ] **9.4** In the same file, add `orderItemsById: {}` to the initial state object inside `create<IOrderFlowStore>()(persist((set, get) => ({ ... })))`. Search for `orderItemTotalQuantity: 0,` near line 87 and update:

```ts
      orderItemTotalQuantity: 0,
      minOrderValue: 0,
      orderItemsById: {},
      orderingData: null,
```

- [ ] **9.5** In the same file, locate `onRehydrateStorage` (already touched by Task 2). Add `orderItemsById` to the inline derivation. After Task 2 the block reads:

```ts
const items = state.orderingData?.orderItems
state.isHydrated = true
state.orderItemTotalQuantity = calcOrderItemTotalQuantity(items)
state.minOrderValue = calcMinOrderValue(items)
```

Add one line:

```ts
const items = state.orderingData?.orderItems
state.isHydrated = true
state.orderItemTotalQuantity = calcOrderItemTotalQuantity(items)
state.minOrderValue = calcMinOrderValue(items)
state.orderItemsById = calcOrderItemsById(items)
```

- [ ] **9.6** In `/Users/phanquyetthang/mobile-movie-app/stores/slices/ordering-items.slice.ts`, update the import block at line ~8 to include `calcOrderItemsById`:

```ts
import {
  calcMinOrderValue,
  calcOrderItemTotalQuantity,
  calcOrderItemsById,
  calcRawSubTotal,
  generateOrderId,
  generateOrderItemId,
  OrderFlowStep,
  type IOrderFlowStore,
  type IOrderingData,
} from '../order-flow.types'
```

- [ ] **9.7** In the same file, every `set({ ... })` that mutates `orderingData.orderItems` must also set `orderItemsById`. Update each of the 7 `set` calls inside `createOrderingItemsMethods`:

**In `addOrderingItem` first branch** (around line 50, where `newOrderingData` is created):

Current:

```ts
set({
  currentStep: OrderFlowStep.ORDERING,
  orderItemTotalQuantity: calcOrderItemTotalQuantity(
    newOrderingData.orderItems,
  ),
  minOrderValue: calcMinOrderValue(newOrderingData.orderItems),
  orderingData: newOrderingData,
  paymentData: null,
  updatingData: null,
  lastModified: dayjs().valueOf(),
})
```

Replace with:

```ts
set({
  currentStep: OrderFlowStep.ORDERING,
  orderItemTotalQuantity: calcOrderItemTotalQuantity(
    newOrderingData.orderItems,
  ),
  minOrderValue: calcMinOrderValue(newOrderingData.orderItems),
  orderItemsById: calcOrderItemsById(newOrderingData.orderItems),
  orderingData: newOrderingData,
  paymentData: null,
  updatingData: null,
  lastModified: dayjs().valueOf(),
})
```

**In `addOrderingItem` second branch** (around line 72):

Current:

```ts
set({
  currentStep: OrderFlowStep.ORDERING,
  orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
  minOrderValue: calcMinOrderValue(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  paymentData: null,
  updatingData: null,
  lastModified: dayjs().valueOf(),
})
```

Replace with:

```ts
set({
  currentStep: OrderFlowStep.ORDERING,
  orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
  minOrderValue: calcMinOrderValue(updatedItems),
  orderItemsById: calcOrderItemsById(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  paymentData: null,
  updatingData: null,
  lastModified: dayjs().valueOf(),
})
```

**In `addOrderingProductVariant`** (around line 95):

Current:

```ts
set({
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

Replace with:

```ts
set({
  orderItemsById: calcOrderItemsById(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

**In `updateOrderingItemVariant`** (around line 119):

Current:

```ts
set({
  minOrderValue: calcMinOrderValue(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

Replace with:

```ts
set({
  minOrderValue: calcMinOrderValue(updatedItems),
  orderItemsById: calcOrderItemsById(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

**In `updateOrderingItemQuantity`** (around line 142):

Current:

```ts
set({
  orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
  minOrderValue: calcMinOrderValue(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

Replace with:

```ts
set({
  orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
  minOrderValue: calcMinOrderValue(updatedItems),
  orderItemsById: calcOrderItemsById(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

**In `removeOrderingItem`** (around line 164):

Current:

```ts
set({
  orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
  minOrderValue: calcMinOrderValue(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

Replace with:

```ts
set({
  orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
  minOrderValue: calcMinOrderValue(updatedItems),
  orderItemsById: calcOrderItemsById(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

**In `addOrderingNote`** (around line 207):

Current:

```ts
set({
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

Replace with:

```ts
set({
  orderItemsById: calcOrderItemsById(updatedItems),
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
```

**In `clearOrderingData`** (around line 218):

Current:

```ts
    clearOrderingData: () => {
      set({
        orderItemTotalQuantity: 0,
        minOrderValue: 0,
        orderingData: null,
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(0)
    },
```

Replace with:

```ts
    clearOrderingData: () => {
      set({
        orderItemTotalQuantity: 0,
        minOrderValue: 0,
        orderItemsById: {},
        orderingData: null,
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(0)
    },
```

- [ ] **9.8** In `/Users/phanquyetthang/mobile-movie-app/stores/cart.store.ts`, locate `useCartItemQuantity` at line ~135. Current code:

```ts
/** Per-item quantity — most atomic, returns primitive */
export const useCartItemQuantity = (itemId: string): number =>
  useOrderFlowStore(
    (s) =>
      s.orderingData?.orderItems?.find((i) => i.id === itemId)?.quantity ?? 0,
  )
```

Replace with:

```ts
/** Per-item quantity — most atomic, returns primitive. O(1) via orderItemsById. */
export const useCartItemQuantity = (itemId: string): number =>
  useOrderFlowStore((s) => s.orderItemsById?.[itemId]?.quantity ?? 0)
```

- [ ] **9.9** Search for any other place that may read `orderingData?.orderItems?.find(...)` for an id-keyed lookup — they can stay (they're outside the hot per-cell path), but verify the new field is wired:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -rn "orderItemsById" stores/ --include="*.ts"
```

Expected matches: declaration in `order-flow.types.ts`, helper, initial state in `order-flow.store.ts`, rehydrate block, 8 set-calls in `ordering-items.slice.ts`, and the selector in `cart.store.ts`.

- [ ] **9.10** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **9.11** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/order-flow.types.ts stores/order-flow.store.ts stores/slices/ordering-items.slice.ts stores/cart.store.ts && git commit -m "perf(cart): add orderItemsById map for O(1) useCartItemQuantity lookup"
```

---

## Final Verification

- [ ] **F.1** Full quality check:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run check
```

- [ ] **F.2** Circular dependency check (Task 6 introduces a new store — confirm it doesn't import anything that imports it back):

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run check-circular
```

- [ ] **F.3** Manual smoke (device or simulator):
  - Cold start with a non-empty cart → cart badge shows correct count on first paint (no flicker). [Task 2]
  - Open menu → tap product → back → repeat with different products. Detail screen shows hero images. [Task 6]
  - Log out → log in as different account → open Order History. Totals match the new account, not the previous one. [Task 3]
  - Receive 3 FCM notifications back-to-back → app badge updates once, not 3 times. [Task 4]
  - Open home → banners auto-rotate, swiping works, no crash at edges. [Task 8]
  - Add 10 items to cart → quickly change quantities. No jank. [Task 9]
  - Throw a synthetic render error inside any screen to confirm AppErrorBoundary shows the fallback (dev only). [Task 1]
