# Performance Deep Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate remaining performance regressions and data-corruption bugs found in the exhaustive Opus 4.7 audit: dead code (~1 000 lines), unnecessary AsyncStorage persist on transient stores, P0 query-key bugs, O(N²) cart selectors, missing staleTime on static queries, and a single-pass aggregator replacing 4 separate array iterations per cart mutation.

**Architecture:** Tasks are fully independent — each produces a working, typechecked, committed change. Execute in any order. Tasks 1–5 are Group-A/B quick wins (<30 min each). Task 6 is a Group-C refactor (~1 h). Task 7 deletes a confirmed dead store. No task touches the C1 mirror-pattern removal (paymentData/updatingData in order-flow.store) — that is a separate architectural plan.

**Tech Stack:** Zustand 4, TanStack React Query 5, TypeScript strict, Expo Router.

---

## Task 1 — Dead code purge

**Why:** ~1 000 lines of unreachable code bloating the bundle and confusing future readers. Each deletion is verified: no import outside the file itself or its barrel.

**Files:**

- Delete: `components/ui/data-table/` (entire folder — 12 files)
- Delete: `hooks/use-data-table.ts`
- Delete: `components/home/news-carousel.tsx`
- Delete: `app/menu/product-image-carousel.tsx`
- Delete: `components/menu/product-image-carousel.tsx`
- Delete: `components/ui/carousel.tsx`
- Delete: `components/profile/profile-header.tsx`
- Modify: `components/menu/index.ts` (remove dead export)
- Modify: `components/profile/index.ts` (remove dead export)
- Modify: `components/ui/index.ts` (remove dead exports)

- [ ] **1.1** Confirm zero non-self consumers for each deleted path:

```bash
cd /Users/phanquyetthang/mobile-movie-app

# data-table
grep -rn "data-table\|DataTable\|useDataTable" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "data-table/" | grep -v "use-data-table.ts" | grep -v "picker.tsx\|select.tsx"

# news-carousel
grep -rn "news-carousel\|NewsCarousel" app components --include="*.tsx" | grep -v node_modules | grep -v "news-carousel.tsx"

# product-image-carousel
grep -rn "ProductImageCarousel\|product-image-carousel" app components --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "product-image-carousel"

# carousel.tsx (ui)
grep -rn "CarouselApi\|from.*ui/carousel\|from.*components/ui.*carousel" app components --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "carousel.tsx\|product-image-carousel"

# profile-header.tsx
grep -rn "from.*components/profile.*profile-header\|ProfileHeader" app components --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "profile-header.tsx\|profile/index.ts"
```

Expected for each: zero output (or only the barrel file itself).

- [ ] **1.2** Delete the data-table folder and use-data-table hook:

```bash
cd /Users/phanquyetthang/mobile-movie-app
rm -rf components/ui/data-table
rm hooks/use-data-table.ts
```

- [ ] **1.3** Delete the remaining dead files:

```bash
cd /Users/phanquyetthang/mobile-movie-app
rm components/home/news-carousel.tsx
rm app/menu/product-image-carousel.tsx
rm components/menu/product-image-carousel.tsx
rm components/ui/carousel.tsx
rm components/profile/profile-header.tsx
```

- [ ] **1.4** Remove `ProductImageCarousel` from `components/menu/index.ts`. Current line 7:

```ts
export { default as ProductImageCarousel } from './product-image-carousel'
```

Delete that line entirely.

- [ ] **1.5** Remove `ProfileHeader` from `components/profile/index.ts`. Current line 21:

```ts
export { ProfileHeader, type ProfileHeaderProps } from './profile-header'
```

Delete that line entirely.

- [ ] **1.6** Remove carousel exports from `components/ui/index.ts`. Current lines 13–14:

```ts
} from './carousel'
export type { CarouselApi } from './carousel'
```

Delete both lines. Also remove any `Carousel, CarouselContent, CarouselItem` from the export on the line ending at 13 — read the file first to see the full block.

- [ ] **1.7** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

Expected: zero errors.

- [ ] **1.8** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add -A && git commit -m "chore: delete ~1000 lines of confirmed dead code (data-table, carousel, news-carousel, product-image-carousel, profile-header)"
```

---

## Task 2 — Remove unnecessary `persist` from transient stores

**Why:** Four stores persist purely transient/session-scoped state to AsyncStorage, causing unnecessary IO on every mutation and ghost-state on cold start:

- `current-url.store.ts` — URL tracking for session debounce; stale after app kill
- `overview-filter.store.ts` — `onRehydrateStorage` immediately resets to default — persist does nothing
- `forgot-password.store.ts` — OTP tokens/steps persist plaintext; expired on relaunch
- `selected-chef-order.store.ts` — persists `isSheetOpen` UI flag

**Files:**

- Modify: `stores/current-url.store.ts`
- Modify: `stores/overview-filter.store.ts`
- Modify: `stores/forgot-password.store.ts`
- Modify: `stores/selected-chef-order.store.ts`

- [ ] **2.1** Replace `stores/current-url.store.ts` entirely — drop `persist`:

```ts
import { create } from 'zustand'

interface ICurrentUrlStore {
  currentUrl: string | null
  lastSetTime: number | null
  setCurrentUrl: (url: string) => void
  clearUrl: () => void
  shouldUpdateUrl: (url: string) => boolean
}

export const useCurrentUrlStore = create<ICurrentUrlStore>()((set, get) => ({
  currentUrl: null,
  lastSetTime: null,
  setCurrentUrl: (url: string) => {
    const now = Date.now()
    set({ currentUrl: url, lastSetTime: now })
  },
  clearUrl: () => set({ currentUrl: null, lastSetTime: null }),
  shouldUpdateUrl: (url: string) => {
    const { currentUrl, lastSetTime } = get()
    const now = Date.now()
    if (!currentUrl) return true
    if (currentUrl !== url) return true
    if (lastSetTime && now - lastSetTime > 5000) return true
    return false
  },
}))
```

- [ ] **2.2** Replace `stores/overview-filter.store.ts` entirely — drop `persist` (onRehydrateStorage reset to default means persist was already a no-op):

```ts
import dayjs from 'dayjs'
import { create } from 'zustand'

import { RevenueTypeQuery } from '@/constants'
import { IOverviewFilter, IOverviewFilterStore } from '@/types'

const defaultOverviewFilter: IOverviewFilter = {
  branch: '',
  startDate: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  endDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  type: RevenueTypeQuery.HOURLY,
}

export const useOverviewFilterStore = create<IOverviewFilterStore>()((set) => ({
  overviewFilter: defaultOverviewFilter,
  setOverviewFilter: (
    overviewFilter:
      | IOverviewFilter
      | ((prev: IOverviewFilter) => IOverviewFilter),
  ) => {
    set((state) => ({
      overviewFilter:
        typeof overviewFilter === 'function'
          ? overviewFilter(state.overviewFilter)
          : overviewFilter,
    }))
  },
  clearOverviewFilter: () => set({ overviewFilter: defaultOverviewFilter }),
  resetToDefault: () => set({ overviewFilter: defaultOverviewFilter }),
}))
```

- [ ] **2.3** In `stores/forgot-password.store.ts`, add `partialize: () => ({})` so the persist wrapper stays (preserving `isHydrated` semantics if any consumer checks it) but nothing writes to AsyncStorage:

Current lines 68–72:

```ts
    {
      name: 'forgot-password-store',
      storage: createJSONStorage(() => createSafeStorage()),
    },
```

Replace with:

```ts
    {
      name: 'forgot-password-store',
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: () => ({}),
    },
```

- [ ] **2.4** In `stores/selected-chef-order.store.ts`, add `partialize` to exclude `isSheetOpen` (transient UI flag):

Current lines 27–30:

```ts
    {
      name: 'selected-chef-order-store',
      storage: createJSONStorage(() => createSafeStorage()),
    },
```

Replace with:

```ts
    {
      name: 'selected-chef-order-store',
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (s) => ({
        chefOrderByChefAreaSlug: s.chefOrderByChefAreaSlug,
        selectedRow: s.selectedRow,
        chefOrderStatus: s.chefOrderStatus,
      }),
    },
```

- [ ] **2.5** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **2.6** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/current-url.store.ts stores/overview-filter.store.ts stores/forgot-password.store.ts stores/selected-chef-order.store.ts && git commit -m "fix(stores): remove unnecessary persist from transient stores (url, filter, forgot-pw, chef-order)"
```

---

## Task 3 — Fix P0 data bugs: payment key collision + query key bugs

**Why:**

- `payment.store.ts` and `payment-method.store.ts` share `name: 'payment-storage'` → AsyncStorage last-write-wins data corruption.
- `payment.store.ts` has zero consumers outside the barrel export → dead store, delete it.
- `useSpecificBanner` uses `[QUERYKEY, slug]` (entire QUERYKEY object) instead of `[QUERYKEY.banners, 'specific', slug]` — wrong cache namespace.
- `useSpecificPublicVoucher` uses `[QUERYKEY.vouchers, data]` which collides with `useVouchers` (same prefix, different shape) — should use `[QUERYKEY.specificVoucher, data]` which already exists.

**Files:**

- Delete: `stores/payment.store.ts`
- Modify: `stores/index.ts`
- Modify: `stores/payment-method.store.ts`
- Modify: `hooks/use-banner.ts`
- Modify: `hooks/use-voucher.ts`

- [ ] **3.1** Confirm `usePaymentStore` has zero consumers in app/component code:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -rn "usePaymentStore\b\|IPaymentStore\b" app components hooks --include="*.tsx" --include="*.ts" | grep -v node_modules
```

Expected: zero output.

- [ ] **3.2** Delete `stores/payment.store.ts`:

```bash
cd /Users/phanquyetthang/mobile-movie-app && rm stores/payment.store.ts
```

- [ ] **3.3** Remove from `stores/index.ts`. Find and delete the line:

```ts
export * from './payment.store'
```

- [ ] **3.4** Check if `IPaymentStore` type is still needed:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -rn "IPaymentStore" --include="*.ts" --include="*.tsx" | grep -v node_modules
```

If only in `types/payment.type.ts` or similar and no longer referenced, delete that interface too (after confirming).

- [ ] **3.5** In `stores/payment-method.store.ts`, fix the key collision. Change line 50:

```ts
      name: 'payment-storage',
```

To:

```ts
      name: 'payment-method-storage',
```

- [ ] **3.6** In `hooks/use-banner.ts`, fix line 35. Change:

```ts
    queryKey: [QUERYKEY, slug],
```

To:

```ts
    queryKey: [QUERYKEY.banners, 'specific', slug],
```

- [ ] **3.7** In `hooks/use-voucher.ts`, fix line 135. Change:

```ts
    queryKey: [QUERYKEY.vouchers, data],
```

To:

```ts
    queryKey: [QUERYKEY.specificVoucher, data],
```

(`QUERYKEY.specificVoucher` already exists in `constants/query.constant.ts` — confirmed.)

- [ ] **3.8** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **3.9** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/payment.store.ts stores/index.ts stores/payment-method.store.ts hooks/use-banner.ts hooks/use-voucher.ts && git commit -m "fix(stores): delete dead payment.store, fix payment-method key collision, fix queryKey bugs in banner and voucher hooks"
```

---

## Task 4 — O(1) cart + order-item selectors

**Why:** `useCartItemVoucherDiscount`, `useCartItem`, `useOrderItem`, `useOrderItemQuantity` all use O(N) `Array.find()`. The store already maintains `orderItemsById: Record<string, IOrderItem>` as an O(1) map (added in the previous plan). With 20 cart items, each cart mutation triggers 80 unnecessary iterations from these 4 selectors × N rows = O(N²) total. Switching to direct object lookup reduces this to O(1) × N = O(N).

**Files:**

- Modify: `stores/cart.store.ts` (lines 62–74 and 129–132)
- Modify: `stores/selectors/order-flow.selectors.ts` (lines 170–180)

- [ ] **4.1** Read the current `useCartItemVoucherDiscount` and `useCartItem` implementations:

```bash
cd /Users/phanquyetthang/mobile-movie-app && sed -n '60,135p' stores/cart.store.ts
```

- [ ] **4.2** In `stores/cart.store.ts`, replace `useCartItemVoucherDiscount` (lines ~62–74):

Current:

```ts
export const useCartItemVoucherDiscount = (cartKey: string): number =>
  useOrderFlowStore((s) => {
    const voucher = s.orderingData?.voucher
    if (!voucher) return 0
    const item = s.orderingData?.orderItems?.find((i) => i.id === cartKey)
    if (!item) return 0
    return calcItemVoucherDiscount(toDisplayItem(item), voucher)
  })
```

Replace with:

```ts
export const useCartItemVoucherDiscount = (cartKey: string): number =>
  useOrderFlowStore((s) => {
    const voucher = s.orderingData?.voucher
    if (!voucher) return 0
    const item = s.orderItemsById?.[cartKey]
    if (!item) return 0
    return calcItemVoucherDiscount(toDisplayItem(item), voucher)
  })
```

- [ ] **4.3** In `stores/cart.store.ts`, replace `useCartItem` (lines ~129–132):

Current:

```ts
export const useCartItem = (itemId: string) =>
  useOrderFlowStore((s) =>
    s.orderingData?.orderItems?.find((i) => i.id === itemId),
  )
```

Replace with:

```ts
export const useCartItem = (itemId: string) =>
  useOrderFlowStore((s) => s.orderItemsById?.[itemId])
```

- [ ] **4.4** Read the current `useOrderItem` and `useOrderItemQuantity` in selectors:

```bash
cd /Users/phanquyetthang/mobile-movie-app && sed -n '165,185p' stores/selectors/order-flow.selectors.ts
```

- [ ] **4.5** In `stores/selectors/order-flow.selectors.ts`, replace `useOrderItem` (lines ~170–174):

Current:

```ts
export const useOrderItem = (itemId: string) =>
  useOrderFlowStore((s) =>
    s.orderingData?.orderItems?.find((i) => i.id === itemId),
  )
```

Replace with:

```ts
export const useOrderItem = (itemId: string) =>
  useOrderFlowStore((s) => s.orderItemsById?.[itemId])
```

- [ ] **4.6** In `stores/selectors/order-flow.selectors.ts`, replace `useOrderItemQuantity` (lines ~176–180):

Current:

```ts
export const useOrderItemQuantity = (itemId: string): number =>
  useOrderFlowStore(
    (s) =>
      s.orderingData?.orderItems?.find((i) => i.id === itemId)?.quantity ?? 0,
  )
```

Replace with:

```ts
export const useOrderItemQuantity = (itemId: string): number =>
  useOrderFlowStore((s) => s.orderItemsById?.[itemId]?.quantity ?? 0)
```

- [ ] **4.7** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **4.8** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/cart.store.ts stores/selectors/order-flow.selectors.ts && git commit -m "perf(cart): switch 4 O(N) find() selectors to O(1) orderItemsById lookup"
```

---

## Task 5 — Add `staleTime` to static queries

**Why:** `useBanners` and `useBranch` have no `staleTime` (default 0), so every screen mount and every focus event triggers a refetch even though banners change at most daily and branches change weekly. Each unnecessary refetch allocates a new response object, busts React Query's structural sharing, and causes all subscribers to re-render.

**Files:**

- Modify: `hooks/use-banner.ts`
- Modify: `hooks/use-branch.ts`

- [ ] **5.1** In `hooks/use-banner.ts`, add `staleTime` to `useBanners` (lines ~18–23):

Current:

```ts
export const useBanners = (params?: IBannerRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.banners, params],
    queryFn: async () => getBanners(params),
  })
}
```

Replace with:

```ts
export const useBanners = (params?: IBannerRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.banners, params],
    queryFn: async () => getBanners(params),
    staleTime: 5 * 60_000, // banners change at most daily; 5 min prevents refetch-on-focus
  })
}
```

- [ ] **5.2** Read `hooks/use-branch.ts` to find the `useBranch` hook (first export, fetches all branches — NOT `useBranchInfoForDelivery` which already has staleTime):

```bash
cd /Users/phanquyetthang/mobile-movie-app && cat hooks/use-branch.ts
```

- [ ] **5.3** Add `staleTime` to `useBranch` only (not `useBranchInfoForDelivery`):

Current:

```ts
export const useBranch = (options?: UseBranchOptions) => {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => getAllBranches(),
    enabled,
  })
}
```

Replace with:

```ts
export const useBranch = (options?: UseBranchOptions) => {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => getAllBranches(),
    enabled,
    staleTime: 10 * 60_000, // branch list changes rarely; 10 min avoids redundant fetches
  })
}
```

- [ ] **5.4** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **5.5** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add hooks/use-banner.ts hooks/use-branch.ts && git commit -m "perf(query): add staleTime to useBanners (5 min) and useBranch (10 min)"
```

---

## Task 6 — Single-pass aggregator for `ordering-items.slice.ts`

**Why:** Every cart mutation (`addOrderingItem`, `updateOrderingItemQuantity`, `removeOrderingItem`, `updateOrderingItemVariant`, `addOrderingNote`, `addOrderingProductVariant`) currently calls four separate functions that each iterate the full `updatedItems` array:

1. `calcOrderItemTotalQuantity(updatedItems)` — O(N)
2. `calcMinOrderValue(updatedItems)` — O(N)
3. `calcOrderItemsById(updatedItems)` — O(N)
4. `calcRawSubTotal(updatedItems)` (inside `useCartDisplayStore.resetAfterCartChange(...)`) — O(N)

That's 4 × O(N) = 200 iterations for a 50-item cart, per every quantity tap. Replacing with a single pass cuts this to O(N) — 75% reduction.

**Files:**

- Modify: `stores/order-flow.types.ts` (add `aggregateOrderItems` helper)
- Modify: `stores/slices/ordering-items.slice.ts` (use single-pass in all 7 mutating actions)

- [ ] **6.1** Read the existing `calcOrderItemTotalQuantity`, `calcMinOrderValue`, `calcRawSubTotal`, `calcOrderItemsById` in `stores/order-flow.types.ts`:

```bash
cd /Users/phanquyetthang/mobile-movie-app && sed -n '190,225p' stores/order-flow.types.ts
```

- [ ] **6.2** After the last existing `calc*` helper in `stores/order-flow.types.ts`, add the single-pass aggregator:

```ts
/**
 * Single-pass aggregation — replaces 4 separate O(N) iterations per cart
 * mutation with one loop. Call once, spread the result into set() and pass
 * rawSubTotal to cart-display store.
 */
export function aggregateOrderItems(items: IOrderItem[] | undefined): {
  orderItemTotalQuantity: number
  minOrderValue: number
  orderItemsById: Record<string, IOrderItem>
  rawSubTotal: number
} {
  if (!items || items.length === 0) {
    return {
      orderItemTotalQuantity: 0,
      minOrderValue: 0,
      orderItemsById: {},
      rawSubTotal: 0,
    }
  }
  let totalQty = 0
  let minOrder = 0
  let rawSub = 0
  const byId: Record<string, IOrderItem> = {}
  for (const it of items) {
    const q = it.quantity || 0
    const orig = it.originalPrice ?? 0
    const promo = it.promotionDiscount ?? 0
    totalQty += q
    minOrder += (orig - promo) * q
    rawSub += orig * q
    if (it.id) byId[it.id] = it
  }
  return {
    orderItemTotalQuantity: totalQty,
    minOrderValue: minOrder,
    orderItemsById: byId,
    rawSubTotal: rawSub,
  }
}
```

- [ ] **6.3** Read all mutating actions in `stores/slices/ordering-items.slice.ts`:

```bash
cd /Users/phanquyetthang/mobile-movie-app && cat stores/slices/ordering-items.slice.ts
```

- [ ] **6.4** In `stores/slices/ordering-items.slice.ts`, add `aggregateOrderItems` to the import from `../order-flow.types`. Find the existing import block and add `aggregateOrderItems` alongside `calcMinOrderValue`, `calcOrderItemTotalQuantity`, etc.

- [ ] **6.5** Remove `calcOrderItemTotalQuantity`, `calcMinOrderValue`, `calcOrderItemsById`, `calcRawSubTotal` from the import (they are now only used inside `aggregateOrderItems`). If they're still used in `onRehydrateStorage` in `order-flow.store.ts`, do NOT remove them there — only remove from the slice import.

Actually: verify which of the four helpers are still needed in the slice after the refactor. If the slice ONLY uses them inside actions (not exported), after refactoring all actions to use `aggregateOrderItems`, those four helpers can be removed from the slice import.

- [ ] **6.6** Refactor all mutating actions to use `aggregateOrderItems`. For each action that currently calls `calcOrderItemTotalQuantity`, `calcMinOrderValue`, `calcOrderItemsById` separately and then calls `useCartDisplayStore.getState().resetAfterCartChange(calcRawSubTotal(updatedItems))`:

Pattern before (example from `updateOrderingItemQuantity`):

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
useCartDisplayStore
  .getState()
  .resetAfterCartChange(calcRawSubTotal(updatedItems))
```

Pattern after:

```ts
const agg = aggregateOrderItems(updatedItems)
set({
  orderItemTotalQuantity: agg.orderItemTotalQuantity,
  minOrderValue: agg.minOrderValue,
  orderItemsById: agg.orderItemsById,
  orderingData: {
    ...orderingData,
    orderItems: updatedItems,
  },
  lastModified: dayjs().valueOf(),
})
useCartDisplayStore.getState().resetAfterCartChange(agg.rawSubTotal)
```

Apply this pattern to all actions that use any of `calcOrderItemTotalQuantity`, `calcMinOrderValue`, `calcOrderItemsById`, `calcRawSubTotal`. The affected actions are:

- Both branches of `addOrderingItem`
- `addOrderingProductVariant`
- `updateOrderingItemVariant`
- `updateOrderingItemQuantity`
- `removeOrderingItem`
- `addOrderingNote`

`clearOrderingData` only sets zeros/empty — no array to iterate — leave it unchanged (it sets `orderItemsById: {}`).

- [ ] **6.7** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **6.8** Sanity check — confirm no remaining direct calls to the old calc helpers from the slice:

```bash
cd /Users/phanquyetthang/mobile-movie-app && grep -n "calcOrderItemTotalQuantity\|calcMinOrderValue\|calcOrderItemsById\|calcRawSubTotal" stores/slices/ordering-items.slice.ts
```

Expected: zero matches (all replaced by `aggregateOrderItems`).

- [ ] **6.9** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add stores/order-flow.types.ts stores/slices/ordering-items.slice.ts && git commit -m "perf(cart): replace 4-pass iteration with single aggregateOrderItems() per cart mutation"
```

---

## Task 7 — Throttled AsyncStorage write wrapper for `useOrderFlowStore`

**Why:** Every cart action (qty+/−, note keystroke after debounce, voucher add/remove) serializes the full `orderingData` to AsyncStorage. On Android, AsyncStorage.setItem is synchronous and blocks the JS thread ~5–15 ms per call. During rapid qty taps, this can fire 5–10 times/second. Wrapping the persist storage with a 300 ms trailing debounce collapses bursts into one write; reads remain immediate since they don't go through the throttle.

**Files:**

- Create: `utils/throttled-storage.ts`
- Modify: `stores/order-flow.store.ts`

- [ ] **7.1** Create `utils/throttled-storage.ts`:

```ts
import type { StateStorage } from 'zustand/middleware'

/**
 * Wraps a StateStorage with a trailing debounce on setItem.
 * Reads and removes are pass-through (immediate).
 * The latest value is always what gets written when the timer fires —
 * never a stale snapshot.
 *
 * @param base  The underlying storage (e.g. createSafeStorage())
 * @param ms    Debounce window in milliseconds (default 300)
 */
export function throttledStorage(base: StateStorage, ms = 300): StateStorage {
  let pending: { key: string; value: string } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    getItem: (key) => base.getItem(key),
    removeItem: (key) => base.removeItem(key),
    setItem: (key, value) => {
      pending = { key, value }
      if (timer !== null) return
      timer = setTimeout(() => {
        timer = null
        if (pending) {
          base.setItem(pending.key, pending.value)
          pending = null
        }
      }, ms)
    },
  }
}
```

- [ ] **7.2** In `stores/order-flow.store.ts`, add the import for `throttledStorage`. Find the existing `createSafeStorage` import:

```ts
import { createSafeStorage } from '@/utils/storage'
```

Add below it:

```ts
import { throttledStorage } from '@/utils/throttled-storage'
```

- [ ] **7.3** In the same file, find the `persist` options block (around lines 764–768). Current:

```ts
    {
      name: 'order-flow-store',
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: ...
```

Change the `storage` line to:

```ts
      storage: createJSONStorage(() => throttledStorage(createSafeStorage(), 300)),
```

- [ ] **7.4** Verify:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run typecheck
```

- [ ] **7.5** Commit:

```bash
cd /Users/phanquyetthang/mobile-movie-app && git add utils/throttled-storage.ts stores/order-flow.store.ts && git commit -m "perf(store): throttle AsyncStorage writes in useOrderFlowStore to 300ms trailing"
```

---

## Final Verification

- [ ] **F.1** Full quality check:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run check
```

Expected: 0 errors, 0 warnings.

- [ ] **F.2** Circular dependency check:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm run check-circular
```

Expected: No circular dependency found.

- [ ] **F.3** Run tests:

```bash
cd /Users/phanquyetthang/mobile-movie-app && npm test
```

Expected: 69 passed, 0 failed.

- [ ] **F.4** Manual smoke:
  - Cold start → no console errors about missing exports from deleted files [Task 1]
  - Forgot-password flow → complete without persisting token to AsyncStorage (verify via `AsyncStorage.getItem('forgot-password-store')` in a breakpoint — should be `null`) [Task 2]
  - Navigate to menu → tap product → back → repeat 10×: no visible jank, payment key `payment-method-storage` in AsyncStorage (not `payment-storage` collision) [Task 3]
  - Add 15 items to cart → rapidly tap +/− on qty → no frame drops visible in Flipper/Perf overlay [Tasks 4, 6, 7]
  - Open home tab → navigate away → return: banner does NOT refetch (check network tab — no request within 5 min window) [Task 5]

---

## Out of scope (separate architectural plan needed)

- **C1 mirror pattern**: `syncPaymentData`/`syncUpdatingData` in `order-flow.store.ts` — 40+ call sites, touches the entire payment/update flow. Requires dedicated plan.
- **Payment store consolidation**: `usePaymentMethodStore` + `usePaymentFlowStore` field overlap — needs consumer audit across payment flow before deletion.
- **`useOrderStore` / `useOrderTypeStore` / `useOrderTrackingStore`** in `stores/order.store.ts` — need consumer audit to confirm redundancy with `useOrderFlowStore`.
- **Image placeholders (L1/L2)**: ~25 Image usages without blurhash — UX improvement, not perf-critical.
- **`unreadCount` field in notification store**: adds derived field maintained in-sync — medium refactor, independent plan.
