# Performance Deep Round 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 P0 data bugs (voucher cache cross-pollution, banner prefetch miss, profile invalidate miss, mock hook in barrel), purge 9 dead stores, eliminate O(N) waste in note mutations, fix isHydrated setTimeout flicker in 2 stores, and maintain `unreadCount` as a cached primitive instead of an O(N) filter on every render.

**Architecture:** 6 independent tasks. Tasks 1–4 and 6 are surgical fixes with no architectural risk (<20 min each). Task 5 adds a maintained `unreadCount` field to `useNotificationStore` — replaces O(N) filter selectors in `NotificationBell` and `notification/index.tsx` with a pure primitive.

**Tech Stack:** Zustand 4, TanStack Query 5, TypeScript strict, Expo Router.

---

## Task 1 — Purge 9 dead stores + 1 mock hook

**Why:**

- 9 stores have zero consumers outside their own file and `stores/index.ts`. Several still persist to MMKV/AsyncStorage on any accidental mutation. Dead code bloats autocomplete, bundle, and error surface.
- `hooks/use-loyalty-point-history.ts` is a stub that returns fabricated data (`lp-1`, `lp-2`, …). It is exported via `hooks/index.ts`. Any future `import { useLoyaltyPointHistory } from '@/hooks'` silently returns fake data with no compile error.

**Files:**

- Delete: `stores/order.store.ts`
- Delete: `stores/current-url.store.ts`
- Delete: `stores/catalog.store.ts`
- Delete: `stores/product-name.store.ts`
- Delete: `stores/price-range.store.ts`
- Delete: `stores/request.store.ts`
- Delete: `stores/expanded-cart-notes.store.ts`
- Delete: `stores/selected-chef-order.store.ts`
- Delete: `stores/overview-filter.store.ts`
- Delete: `hooks/use-loyalty-point-history.ts`
- Modify: `stores/index.ts`
- Modify: `hooks/index.ts`

- [ ] **1.1** Confirm zero consumers for each store and hook:

```bash
cd /Users/phanquyetthang/mobile-movie-app

# Stores
grep -rn "useOrderStore\|useOrderTypeStore\|useOrderTrackingStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "order.store.ts"
grep -rn "useCurrentUrlStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "current-url.store.ts"
grep -rn "useCatalogStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "catalog.store.ts"
grep -rn "useProductNameStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "product-name.store.ts"
grep -rn "usePriceRangeStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "price-range.store.ts"
grep -rn "useRequestStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "request.store.ts"
grep -rn "useExpandedCartNotesStore\|useIsExpandedCartNote" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "expanded-cart-notes.store.ts"
grep -rn "useSelectedChefOrderStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "selected-chef-order.store.ts"
grep -rn "useOverviewFilterStore" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "overview-filter.store.ts"

# Hook
grep -rn "useLoyaltyPointHistory" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "use-loyalty-point-history.ts"
```

Expected for each: zero output. If any grep returns a hit, STOP and report `BLOCKED`.

- [ ] **1.2** Delete the 9 store files:

```bash
cd /Users/phanquyetthang/mobile-movie-app
rm stores/order.store.ts
rm stores/current-url.store.ts
rm stores/catalog.store.ts
rm stores/product-name.store.ts
rm stores/price-range.store.ts
rm stores/request.store.ts
rm stores/expanded-cart-notes.store.ts
rm stores/selected-chef-order.store.ts
rm stores/overview-filter.store.ts
```

- [ ] **1.3** Delete the mock hook:

```bash
cd /Users/phanquyetthang/mobile-movie-app
rm hooks/use-loyalty-point-history.ts
```

- [ ] **1.4** Read `stores/index.ts`, then remove all 9 dead store exports. The lines to delete are:

```ts
export * from './catalog.store'
export * from './current-url.store'
export * from './expanded-cart-notes.store'
export * from './order.store'
export * from './overview-filter.store'
export * from './price-range.store'
export * from './product-name.store'
export * from './request.store'
export * from './selected-chef-order.store'
```

Delete each line exactly. Do not touch any other line.

- [ ] **1.5** Read `hooks/index.ts`, then find and delete the line that exports `useLoyaltyPointHistory`. It will look like:

```ts
export { useLoyaltyPointHistory } from './use-loyalty-point-history'
```

or similar. Delete that line only.

- [ ] **1.6** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: zero errors.

- [ ] **1.7** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add -A && git commit -m "chore: delete 9 dead stores and 1 mock loyalty hook"
```

---

## Task 2 — Fix P0 queryKey bugs

**Why:**
Three independent queryKey bugs cause silent data failures:

1. **Voucher cache cross-pollution:** `useSpecificVoucher` (authenticated) and `useSpecificPublicVoucher` (guest) both use `queryKey: [QUERYKEY.specificVoucher, data]`. With the same voucher code/slug, whichever runs first populates the cache; the other returns data from the wrong endpoint. Guests can see authenticated voucher rules; logged-in users can see the degraded public response.

2. **Banner prefetch miss:** `usePredictivePrefetch` prefetches with `queryKey: ['banners', BannerPage.HOME]`. But `useBanners` uses `queryKey: [QUERYKEY.banners, params]` = `[['banners'], { page, isActive }]`. These two keys hash differently — the prefetch never warms the cache that `useBanners` reads. Home tab always pays a network round-trip on entry.

3. **Profile invalidate never fires:** After phone/email OTP verification, code calls `invalidateQueries({ queryKey: [QUERYKEY.profile] })` = `[['profile']]`. But `useProfile` uses flat `queryKey: ['profile']`. The nested key never matches → profile remains stale after verification.

**Files:**

- Modify: `hooks/use-voucher.ts` (lines ~120, ~135)
- Modify: `hooks/use-predictive-prefetch.ts` (line ~80)
- Modify: `app/profile/verify-phone-number.tsx` (lines ~382–383, ~425–426)
- Modify: `app/profile/verify-email.tsx` (lines ~400, ~481)

- [ ] **2.1** Fix voucher queryKey in `hooks/use-voucher.ts`.

Read the file to find `useSpecificVoucher` (~line 120) and `useSpecificPublicVoucher` (~line 135).

Change `useSpecificVoucher` queryKey from:

```ts
    queryKey: [QUERYKEY.specificVoucher, data],
```

To:

```ts
    queryKey: [QUERYKEY.specificVoucher, 'private', data],
```

Change `useSpecificPublicVoucher` queryKey from:

```ts
    queryKey: [QUERYKEY.specificVoucher, data],
```

To:

```ts
    queryKey: [QUERYKEY.specificVoucher, 'public', data],
```

- [ ] **2.2** Fix banner prefetch key in `hooks/use-predictive-prefetch.ts`.

Read the file. Find the `queryClient.prefetchQuery` call for banners (~line 80). It currently uses:

```ts
queryClient.prefetchQuery({
  queryKey: ['banners', BannerPage.HOME],
  queryFn: () => getBanners({ page: BannerPage.HOME, isActive: true }),
})
```

The home screen calls `useBanners({ page: BannerPage.HOME, isActive: true })`, which uses key `[QUERYKEY.banners, { page: BannerPage.HOME, isActive: true }]`. Match that exactly:

```ts
queryClient.prefetchQuery({
  queryKey: [QUERYKEY.banners, { page: BannerPage.HOME, isActive: true }],
  queryFn: () => getBanners({ page: BannerPage.HOME, isActive: true }),
})
```

`QUERYKEY` is already imported in this file — do not add a new import.

- [ ] **2.3** Fix profile invalidate in `app/profile/verify-phone-number.tsx`.

Read the file. Find all `invalidateQueries({ queryKey: [QUERYKEY.profile] })` calls (~lines 382–383, 425–426). `useProfile` uses flat key `['profile']`. Change each occurrence from:

```ts
          queryKey: [QUERYKEY.profile],
```

To:

```ts
          queryKey: ['profile'],
```

There are 2 occurrences. Change both.

- [ ] **2.4** Fix profile invalidate in `app/profile/verify-email.tsx`.

Same fix. Find all `invalidateQueries({ queryKey: [QUERYKEY.profile] })` calls (~lines 400, 481). Change each from:

```ts
          queryKey: [QUERYKEY.profile],
```

To:

```ts
          queryKey: ['profile'],
```

There are 2 occurrences. Change both.

- [ ] **2.5** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **2.6** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add hooks/use-voucher.ts hooks/use-predictive-prefetch.ts app/profile/verify-phone-number.tsx app/profile/verify-email.tsx && git commit -m "fix(query): fix voucher cache cross-pollution, banner prefetch miss, profile invalidate miss"
```

---

## Task 3 — O(1) map update for `addOrderingNote` and `addOrderingProductVariant`

**Why:** These two actions currently call `aggregateOrderItems(updatedItems).orderItemsById` — which runs a full O(N) loop — just to rebuild the `orderItemsById` map after a note change or variant init. Neither action changes quantity or price, so rebuilding `orderItemTotalQuantity`, `minOrderValue`, and `rawSubTotal` is wasted work. A note change on item `X` should patch only `orderItemsById[X]` — O(1).

**Files:**

- Modify: `stores/slices/ordering-items.slice.ts`

- [ ] **3.1** Read the current implementations:

```bash
cd /Users/phanquyetthang/mobile-movie-app && sed -n '85,130p' stores/slices/ordering-items.slice.ts
sed -n '200,230p' stores/slices/ordering-items.slice.ts
```

- [ ] **3.2** Replace `addOrderingProductVariant` (~line 88):

Current:

```ts
    addOrderingProductVariant: (id: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === id ? { ...item, variant: item.variant || [] } : item,
      )

      set({
        orderItemsById: aggregateOrderItems(updatedItems).orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
    },
```

Replace with:

```ts
    addOrderingProductVariant: (id: string) => {
      const { orderingData, orderItemsById } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === id ? { ...item, variant: item.variant || [] } : item,
      )
      const prev = orderItemsById?.[id]

      set({
        orderItemsById: prev
          ? { ...orderItemsById, [id]: { ...prev, variant: prev.variant || [] } }
          : orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
    },
```

- [ ] **3.3** Replace `addOrderingNote` (~line 201):

Current:

```ts
    addOrderingNote: (itemId: string, note: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === itemId ? { ...item, note } : item,
      )

      set({
        orderItemsById: aggregateOrderItems(updatedItems).orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
    },
```

Replace with:

```ts
    addOrderingNote: (itemId: string, note: string) => {
      const { orderingData, orderItemsById } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === itemId ? { ...item, note } : item,
      )
      const prev = orderItemsById?.[itemId]

      set({
        orderItemsById: prev
          ? { ...orderItemsById, [itemId]: { ...prev, note } }
          : orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
    },
```

- [ ] **3.4** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **3.5** Sanity check — confirm `aggregateOrderItems` is no longer called in these two functions:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -n "aggregateOrderItems" stores/slices/ordering-items.slice.ts
```

Expected: the remaining lines should be the 6 other mutating actions (addOrderingItem both branches, updateOrderingItemVariant, updateOrderingItemQuantity, removeOrderingItem). `addOrderingNote` and `addOrderingProductVariant` should NOT appear.

- [ ] **3.6** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/slices/ordering-items.slice.ts && git commit -m "perf(cart): O(1) orderItemsById patch for addOrderingNote and addOrderingProductVariant"
```

---

## Task 4 — Fix `isHydrated` setTimeout flicker in 2 stores

**Why:** `stores/payment-flow.store.ts` and `stores/update-order-flow.store.ts` both set `isHydrated = true` inside a `setTimeout(..., 0)` inside `onRehydrateStorage`. This causes a one-frame window after app restart where `isHydrated` is `false`, making consumer components (payment guards, update-order guards) see stale `false` and potentially render loading states incorrectly. The `useOrderFlowStore` was already fixed in Round 1 to set `isHydrated` inline on the rehydrated state object — these two stores should follow the same pattern.

**Files:**

- Modify: `stores/payment-flow.store.ts`
- Modify: `stores/update-order-flow.store.ts`

- [ ] **4.1** Read the relevant section of `stores/payment-flow.store.ts`:

```bash
cd /Users/phanquyetthang/mobile-movie-app && sed -n '105,120p' stores/payment-flow.store.ts
```

- [ ] **4.2** In `stores/payment-flow.store.ts`, find the `onRehydrateStorage` block. Current:

```ts
      onRehydrateStorage: () => () => {
        setTimeout(() => {
          usePaymentFlowStore.setState({ isHydrated: true })
        }, 0)
      },
```

Replace with:

```ts
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.isHydrated = true
      },
```

- [ ] **4.3** Read the relevant section of `stores/update-order-flow.store.ts`:

```bash
cd /Users/phanquyetthang/mobile-movie-app && sed -n '160,175p' stores/update-order-flow.store.ts
```

- [ ] **4.4** In `stores/update-order-flow.store.ts`, find the `onRehydrateStorage` block. Current:

```ts
      onRehydrateStorage: () => () => {
        setTimeout(() => {
          useUpdateOrderFlowStore.setState({ isHydrated: true })
        }, 0)
      },
```

Replace with:

```ts
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.isHydrated = true
      },
```

- [ ] **4.5** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **4.6** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/payment-flow.store.ts stores/update-order-flow.store.ts && git commit -m "fix(stores): inline isHydrated=true in onRehydrateStorage for payment-flow and update-order-flow stores"
```

---

## Task 5 — `unreadCount` primitive in `useNotificationStore`

**Why:** Two places in the app compute unread notification count by filtering the entire `notifications` array on every store update:

- `components/notification/notification-bell.tsx:22` — for-loop selector, O(N) per re-render
- `app/notification/index.tsx:316` — `.filter().length`, O(N) per re-render

Both run every time any notification is added, read, or rehydrated. With 50 notifications, this is 50 iterations × every subscriber × every store mutation. Maintaining `unreadCount` as a first-class primitive eliminates this: each mutator computes the new count once (already doing O(N) work for other reasons), stores it, and selectors just read `s.unreadCount` — O(1).

**Files:**

- Modify: `stores/notification.store.ts`
- Modify: `components/notification/notification-bell.tsx`
- Modify: `app/notification/index.tsx`

- [ ] **5.1** Read `stores/notification.store.ts` fully:

```bash
cd /Users/phanquyetthang/mobile-movie-app && cat stores/notification.store.ts
```

- [ ] **5.2** In `stores/notification.store.ts`, add `unreadCount: number` to the `NotificationStore` interface. The interface currently has `notifications`, `markedAllReadAt`, action methods. Add after `markedAllReadAt`:

```ts
unreadCount: number
```

Also remove `getUnreadCount: () => number` from the interface (it will be replaced by the primitive field).

- [ ] **5.3** In the store implementation initial state, add `unreadCount: 0` after `markedAllReadAt: null,`.

- [ ] **5.4** Update `addNotification`. After computing `updated` (the new notifications array), compute and set `unreadCount`:

Current ending of `addNotification`:

```ts
      const filtered = state.notifications.filter((n) => n.slug !== item.slug)
      const updated = [item, ...filtered].slice(0, MAX_NOTIFICATIONS)
      return { notifications: updated }
    })
    syncBadge(get().notifications.filter((n) => !n.isRead).length)
  },
```

Replace with:

```ts
      const filtered = state.notifications.filter((n) => n.slug !== item.slug)
      const updated = [item, ...filtered].slice(0, MAX_NOTIFICATIONS)
      let unreadCount = 0
      for (const n of updated) if (!n.isRead) unreadCount++
      return { notifications: updated, unreadCount }
    })
    syncBadge(get().unreadCount)
  },
```

- [ ] **5.5** Update `markAsRead`. After computing the mapped array, compute and set `unreadCount`:

Current:

```ts
  markAsRead: (slug) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.slug === slug ? { ...n, isRead: true } : n,
      ),
    }))
    syncBadge(get().notifications.filter((n) => !n.isRead).length)
  },
```

Replace with:

```ts
  markAsRead: (slug) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.slug === slug ? { ...n, isRead: true } : n,
      )
      let unreadCount = 0
      for (const n of notifications) if (!n.isRead) unreadCount++
      return { notifications, unreadCount }
    })
    syncBadge(get().unreadCount)
  },
```

- [ ] **5.6** Update `markAllAsRead`:

Current:

```ts
  markAllAsRead: () => {
    const ts = new Date().toISOString()
    set((state) => ({
      markedAllReadAt: ts,
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }))
    syncBadge(0)
  },
```

Replace with:

```ts
  markAllAsRead: () => {
    const ts = new Date().toISOString()
    set((state) => ({
      markedAllReadAt: ts,
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }))
    syncBadge(0)
  },
```

- [ ] **5.7** Update `setReadStates`:

Current:

```ts
  setReadStates: (updates) => {
    const map = new Map(updates.map((u) => [u.slug, u.isRead]))
    set((state) => ({
      notifications: state.notifications.map((n) =>
        map.has(n.slug) ? { ...n, isRead: map.get(n.slug)! } : n,
      ),
    }))
    syncBadge(get().notifications.filter((n) => !n.isRead).length)
  },
```

Replace with:

```ts
  setReadStates: (updates) => {
    const map = new Map(updates.map((u) => [u.slug, u.isRead]))
    set((state) => {
      const notifications = state.notifications.map((n) =>
        map.has(n.slug) ? { ...n, isRead: map.get(n.slug)! } : n,
      )
      let unreadCount = 0
      for (const n of notifications) if (!n.isRead) unreadCount++
      return { notifications, unreadCount }
    })
    syncBadge(get().unreadCount)
  },
```

- [ ] **5.8** Update `clearAll`:

Current:

```ts
  clearAll: () => {
    set({ notifications: [], markedAllReadAt: null })
    syncBadge(0)
  },
```

Replace with:

```ts
  clearAll: () => {
    set({ notifications: [], markedAllReadAt: null, unreadCount: 0 })
    syncBadge(0)
  },
```

- [ ] **5.9** Remove `getUnreadCount` method. Delete these lines:

```ts
  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.isRead).length
  },
```

- [ ] **5.10** Update `hydrateFromApi`. After computing the final `merged` array, add `unreadCount`:

Find the `return { notifications: merged, ... }` inside the `set()` call at the end of `hydrateFromApi`. Current:

```ts
return {
  notifications: merged,
  ...(isDifferentUser ? { markedAllReadAt: null } : {}),
}
```

Replace with:

```ts
let unreadCount = 0
for (const n of merged) if (!n.isRead) unreadCount++
return {
  notifications: merged,
  unreadCount,
  ...(isDifferentUser ? { markedAllReadAt: null } : {}),
}
```

- [ ] **5.11** Update `components/notification/notification-bell.tsx`. Read the file, then find the selector:

```ts
const unreadCount = useNotificationStore((s) => {
  let count = 0
  for (const n of s.notifications) if (!n.isRead) count++
  return count
})
```

Replace with:

```ts
const unreadCount = useNotificationStore((s) => s.unreadCount)
```

- [ ] **5.12** Update `app/notification/index.tsx`. Read the file (~line 316), find:

```ts
const unreadCount = useNotificationStore(
  (s) => s.notifications.filter((n) => !n.isRead).length,
)
```

Replace with:

```ts
const unreadCount = useNotificationStore((s) => s.unreadCount)
```

- [ ] **5.13** Check if `getUnreadCount` is called anywhere:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -rn "getUnreadCount" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules
```

If any callers exist, replace with `useNotificationStore.getState().unreadCount` for non-hook call sites, or `useNotificationStore((s) => s.unreadCount)` inside hooks/components.

- [ ] **5.14** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **5.15** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/notification.store.ts components/notification/notification-bell.tsx app/notification/index.tsx && git commit -m "perf(notification): maintain unreadCount as cached primitive, remove O(N) filter from selectors"
```

---

## Task 6 — Quick wins: narrow notification effect dep + invoice staleTime

**Why:**

- `app/notification/index.tsx` has a `useEffect` that calls `hydrateFromApi` with dep `[apiData]`. React Query replaces the `apiData` wrapper object on every refetch even when the `items` array content is unchanged — causing the effect to run and re-merge all 50 notifications unnecessarily on every focus/polling cycle. Narrowing to `apiData?.result?.items` prevents false fires.
- `useGetOrderInvoice` and `useGetPublicOrderInvoice` in `hooks/use-order.ts` have no `staleTime`. Invoices are immutable once generated; every focus event triggers a refetch.

**Files:**

- Modify: `app/notification/index.tsx`
- Modify: `hooks/use-order.ts`

- [ ] **6.1** In `app/notification/index.tsx`, find the effect that calls `hydrateFromApi`:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -n "hydrateFromApi\|apiData" app/notification/index.tsx | head -10
```

Current effect:

```ts
useEffect(() => {
  const items = apiData?.result?.items
  if (items && items.length > 0) {
    useNotificationStore.getState().hydrateFromApi(items)
  }
}, [apiData])
```

Change the dep from `[apiData]` to `[apiData?.result?.items]`:

```ts
useEffect(() => {
  const items = apiData?.result?.items
  if (items && items.length > 0) {
    useNotificationStore.getState().hydrateFromApi(items)
  }
}, [apiData?.result?.items])
```

- [ ] **6.2** In `hooks/use-order.ts`, find `useGetOrderInvoice` and `useGetPublicOrderInvoice`:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -n "order-invoice\|public-order-invoice\|queryKey\|staleTime" hooks/use-order.ts | head -20
```

Find the two invoice hooks (they use queryKeys `'order-invoice'` and `'public-order-invoice'`). Add `staleTime: Infinity` and `gcTime: 10 * 60_000` to each:

For `useGetOrderInvoice`, add inside `useQuery({…})`:

```ts
    staleTime: Infinity,
    gcTime: 10 * 60_000,
```

For `useGetPublicOrderInvoice`, add inside `useQuery({…})`:

```ts
    staleTime: Infinity,
    gcTime: 10 * 60_000,
```

Read the actual hook implementations before editing to ensure you're adding to the right location.

- [ ] **6.3** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **6.4** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add app/notification/index.tsx hooks/use-order.ts && git commit -m "perf(notification): narrow hydrateFromApi effect dep; fix(query): staleTime=Infinity for immutable invoices"
```

---

## Final Verification

- [ ] **F.1** Full quality check:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run check
```

Expected: 0 errors, 0 warnings.

- [ ] **F.2** Tests:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm test
```

Expected: 69 passed, 0 failed.

- [ ] **F.3** Manual smoke:
  - Open home tab → navigate away → return within 5 min: banners do NOT refetch (network tab — no request) — confirms prefetch key fix [Task 2]
  - Add OTP on profile → complete verification: profile data updates immediately without reload [Task 2]
  - Verify payment screen and update-order screen load without flash/loading state on cold start [Task 4]
  - Add note to cart item → qty badge and cart total unchanged [Task 3]
  - Receive a notification → `NotificationBell` badge increments [Task 5]
  - Mark all as read → badge goes to 0 [Task 5]

---

## Out of scope (separate plan if needed)

- **QUERYKEY architectural standardization** — changing all `QUERYKEY.X = ['value']` to `'value'` (strings) to prevent future key-collision bugs. Large cross-cutting refactor; all 40+ query hooks need updating. The three P0 bugs above are fixed surgically without it.
- **Update-order screen setInterval → FCM** — involves rewiring real-time order status to FCM push + `useFocusEffect`. Separate plan.
- **Profile userInfo atomic selectors** — profile screen subscribes to entire `userInfo` object. Requires reading the full profile screen implementation to split safely.
- **useDownloadStore atomic selectors** — low priority; download screen is rarely used.
