# Menu per-catalog lazy loading + new paged envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Adapt to the new paged `/menu/specific` envelope (BREAKING) and lighten the Menu + update-order load by fetching **per catalog, progressively** — keeping catalog grouping intact with no reshuffle. Preserve every existing render/drop-frame optimization on the Menu screen.

**Architecture:** The endpoint now returns `result = { items: ISpecificMenu[], total, page, pageSize, totalPages, hasNext, hasPrevios }`; menu items live in `result.items[].menuItems`. A helper flattens it. The Menu shows catalog sections; instead of one all-items request, it issues **one query per catalog** (via `useQueries`) and loads catalogs progressively (load N, load more on scroll). Because each catalog is fetched contiguously, grouping never reshuffles and no BE catalog-sort is required. Special filters (isNewProduct/isTopSell) — which don't combine with `catalog` — take a single-query fallback path.

**Tech Stack:** React Native + Expo (Fabric ON), FlashList v2, TanStack React Query v5 (`useQueries`).

## Global Constraints

- No semicolons, single quotes, trailing commas, print width 80. TS strict. ESLint clean.
- **No commits** — working tree only.
- **Verified contract (sandbox 2026-07-15):**
  - `result.items[].menuItems` holds items; paging meta on `result` (`total,page,pageSize,totalPages,hasNext,hasPrevios`).
  - Omitting `hasPaging` returns all items of the (filtered) request in one page.
  - `catalog=slug` returns only that catalog, `total` scoped to it. `catalog + minPrice/maxPrice` works. `catalog + hasPaging + page/size` paginates within the catalog.
  - `catalog + isTopSell/isNewProduct` returned 0 (ambiguous — treat special filters as a NON-per-catalog path).
- **Page size / progressive:** `MENU_CATALOG_BATCH = 3` (catalogs loaded per step). Within a catalog, fetch fully (no item paging) — catalogs are small.

## ⚠️ Preserve constraints (Menu screen — verify in every review)

The Menu screen has tuned optimizations that MUST survive this rewrite. A reviewer must confirm each:
1. **`renderItem` stays ref-stable** — its `useCallback` deps must NOT include the per-render `useQueries` array; handlers keep reading from `itemsMapRef`/`getState`.
2. **The combined item list is memoized on data references** — `useQueries` returns a new array every render; the combine MUST be `useMemo`'d on the individual `data` refs so `itemsRaw`/`flatItems`/FlashList `data` identity only changes when real data changes.
3. **FlashList `data` identity stable across renders** unless items actually change.
4. Untouched and kept: `MenuItemRow`/`MenuItemImage` memo + comparator, phase-gate reveal (staggered), scroll prefetch (`onViewableItemsChanged`), `getItemType`/`refreshControl`/`ListEmptyComponent` memoization, `heroImageUrls` lazy, error-toast `meta`.
5. Not in scope: image texture size (separate resize ticket) — this plan neither fixes nor changes it.

---

### Task 1: Types + API envelope + helper

**Files:** `types/menu.type.ts`, `api/menu.ts`

- [ ] **Step 1:** `types/menu.type.ts` — add:
```ts
export interface ISpecificMenuPaged {
  items: ISpecificMenu[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrevios?: boolean
}
```
Extend `ISpecificMenuRequest` with `page?: number`, `size?: number`, `hasPaging?: boolean`.

- [ ] **Step 2:** `api/menu.ts` — change `getSpecificMenu`/`getPublicSpecificMenu` return types to `Promise<IApiResponse<ISpecificMenuPaged>>`. Add:
```ts
/** Flatten the paged specific-menu envelope to a flat menu-item array. */
export function extractMenuItems(
  res: ISpecificMenuPaged | undefined | null,
): IMenuItem[] {
  return res?.items?.flatMap((m) => m.menuItems ?? []) ?? []
}
```
Confirm `buildSpecificMenuRequest` passes `catalog`/`minPrice`/`maxPrice` through (it does); `page/size/hasPaging` are spread in at call sites.

- [ ] **Step 3:** Verify `npx eslint api/menu.ts types/menu.type.ts` clean. (Typecheck will fail in consumers — fixed in later tasks.)

---

### Task 2: `useCatalogMenuPages` hook (per-catalog progressive loader)

**Files:** Create `hooks/use-catalog-menu-pages.ts`

**Interfaces:**
- Produces `useCatalogMenuPages({ catalogSlugs, request, hasUser, enabled, batch })` →
  `{ menuItems: IMenuItem[], isLoading: boolean, isLoadingMore: boolean, hasMore: boolean, loadMore: () => void, refetchAll: () => void }`

- [ ] **Step 1:** Implement:
```ts
import { useCallback, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  extractMenuItems,
  getPublicSpecificMenu,
  getSpecificMenu,
} from '@/api/menu'
import type { IMenuItem, ISpecificMenuRequest } from '@/types'

export function useCatalogMenuPages(opts: {
  catalogSlugs: string[]
  request: ISpecificMenuRequest
  hasUser: boolean
  enabled: boolean
  batch: number
}) {
  const { catalogSlugs, request, hasUser, enabled, batch } = opts
  const [loadedCount, setLoadedCount] = useState(batch)
  const slugs = useMemo(
    () => catalogSlugs.slice(0, loadedCount),
    [catalogSlugs, loadedCount],
  )
  const fetcher = hasUser ? getSpecificMenu : getPublicSpecificMenu
  const keyRoot = hasUser ? 'specific-menu' : 'public-specific-menu'

  const results = useQueries({
    queries: slugs.map((slug) => {
      const q: ISpecificMenuRequest = { ...request, catalog: slug }
      return {
        queryKey: [keyRoot, q],
        queryFn: () => fetcher(q),
        enabled,
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnMount: false,
        meta: { skipGlobalErrorCodes: [401, 403] },
      }
    }),
  })

  // Memoize on the data refs so identity only changes when a catalog's data changes.
  const dataRefs = results.map((r) => r.data)
  const menuItems = useMemo(
    () => dataRefs.flatMap((d) => extractMenuItems(d?.result)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dataRefs,
  )

  const isLoading = results.length > 0 && results.every((r) => r.isPending)
  const isLoadingMore = results.some((r) => r.isPending)
  const hasMore = loadedCount < catalogSlugs.length
  const loadMore = useCallback(() => {
    setLoadedCount((c) => Math.min(c + batch, catalogSlugs.length))
  }, [batch, catalogSlugs.length])
  const refetchAll = useCallback(() => {
    results.forEach((r) => r.refetch())
  }, [results])

  return { menuItems, isLoading, isLoadingMore, hasMore, loadMore, refetchAll }
}
```
Notes: the `dataRefs` spread as the `useMemo` dep array is intentional (memoize on each catalog's `data` reference) — hence the eslint-disable. `loadMore` grows `loadedCount`; when `catalogSlugs` is a single selected catalog, there is nothing more to load. To load ALL (search), callers pass a `catalogSlugs` list and can call `loadMore` until `!hasMore`, OR set `batch` = `catalogSlugs.length`.

- [ ] **Step 2:** Verify `npm run typecheck && npx eslint hooks/use-catalog-menu-pages.ts` clean.

---

### Task 3: Integrate into the Menu tab (preserve all optimizations)

**Files:** `app/(tabs)/menu/index.tsx`

**Two paths:**
- **Per-catalog path** (default / catalog chip / price / search): `catalogSlugs = menuCatalog ? [menuCatalog] : catalogList.map(c => c.slug)`. Use `useCatalogMenuPages`. When `searchKeyword` is set, load all catalogs (pass `batch = catalogList.length`, or call `loadMore` until `!hasMore`).
- **Special-filter path** (`menuIsNewProduct || menuIsTopSell`): a single `useQuery` with the current `request` (no per-catalog), `extractMenuItems(data?.result)`. Small result set, no paging.

- [ ] **Step 1:** Compute `const useSpecialPath = !!(menuIsNewProduct || menuIsTopSell)`. Build `catalogSlugs` (memoized) from `catalogList`.

- [ ] **Step 2:** Call BOTH hooks unconditionally (Rules of Hooks), gate via `enabled`:
  - `useCatalogMenuPages({ catalogSlugs, request, hasUser, enabled: hasBranch && allowFetch && !useSpecialPath, batch: searchKeyword ? catalogSlugs.length : MENU_CATALOG_BATCH })`
  - a single `useQuery` for the special path, `enabled: hasBranch && allowFetch && useSpecialPath`.
  Select the active source: `const sourceItems = useSpecialPath ? specialItems : catalogPages.menuItems`.

- [ ] **Step 3:** Change `itemsRaw`'s source from `menuData?.result?.menuItems` to `sourceItems` (dep `[sourceItems]`). **Keep the transform, `itemsMapRef` sync effect, `filteredItems`, `flatItems`, and all handlers exactly as-is** (Preserve constraints #1, #2). `flatItems` still buckets by catalog for grouping — with per-catalog data it stays contiguous.

- [ ] **Step 4:** FlashList `onEndReached`: `if (!useSpecialPath && catalogPages.hasMore && !catalogPages.isLoadingMore) catalogPages.loadMore()`; `onEndReachedThreshold={0.6}`.

- [ ] **Step 5:** Rework loading/empty state: `isFetching` → `useSpecialPath ? specialQuery.isFetching : catalogPages.isLoading`. Keep the memoized `listEmptyComponent`; feed it the combined loading flag. Update `handleRefresh` to call `catalogPages.refetchAll()` / special refetch.

- [ ] **Step 6:** Import `useCatalogMenuPages`, `extractMenuItems`, `MENU_CATALOG_BATCH = 3`. Remove now-unused single-menu `useQuery` wiring replaced by the two paths.

- [ ] **Step 7:** Verify `npm run typecheck && npx eslint "app/(tabs)/menu/index.tsx"` clean. Manual device check (Task 6).

---

### Task 4: Update-order menu — per-catalog

**Files:** `app/update-order/components/update-order-menus.tsx`

- [ ] **Step 1:** This screen already groups by catalog (`groupedItems`) and now virtualizes (FlashList scrolls). Replace `useSpecificMenu`/`usePublicSpecificMenu` (single) with `useCatalogMenuPages` over `catalogs.result.map(c => c.slug)`. Derive `menuItems` from the hook; keep the existing sort + `groupedItems` + `flatListData` logic (it already buckets by catalog).
- [ ] **Step 2:** Add `onEndReached` → `loadMore` (the FlashList already scrolls after the earlier virtualization fix).
- [ ] **Step 3:** Verify `npm run typecheck && npx eslint "app/update-order/components/update-order-menus.tsx"` clean.

---

### Task 5: Non-display consumers — adapt envelope only

**Files:** `hooks/use-menu.ts`, `hooks/use-cart-validation.ts`, `components/menu/slider-related-products.tsx`, `hooks/use-predictive-prefetch.ts`, `app/(tabs)/_layout.tsx`

- [ ] **Step 1:** `use-menu.ts` — `useSpecificMenu`/`usePublicSpecificMenu` now return `IApiResponse<ISpecificMenuPaged>`. Keep as plain `useQuery`; callers use `extractMenuItems`.
- [ ] **Step 2:** `use-cart-validation.ts` — needs the FULL menu: request WITHOUT `hasPaging`/page/size (returns all in one page). Change read to `extractMenuItems(menuData?.result)`.
- [ ] **Step 3:** `slider-related-products.tsx` — change `result.menuItems` reads to `extractMenuItems(data?.result)`.
- [ ] **Step 4:** `use-predictive-prefetch.ts` + `_layout.tsx` — the Menu tab now uses per-catalog `useQueries`; a single-key `prefetchQuery` no longer matches the screen's cache. Change the menu prefetch to prefetch the FIRST catalog's query (`{...menuRequest, catalog: firstCatalogSlug}` with the same key shape), OR drop the menu prefetch if catalog slugs aren't available at prefetch time (document which). Keep `meta: { skipGlobalError: true }`.
- [ ] **Step 5:** Verify `npm run typecheck && npx eslint <all five files>` clean.

---

### Task 6: Full verification gate

- [ ] **Step 1:** `npm run typecheck && npm run lint` pass.
- [ ] **Step 2:** `grep -rn "result?.menuItems\|result.menuItems" app hooks components` → no matches.
- [ ] **Step 3:** Review confirms the 3 Preserve constraints (ref-stable renderItem, memoized combine, stable FlashList data).
- [ ] **Step 4:** Manual device (sandbox) check:
  - Menu "All": first ~3 catalogs load; scrolling loads more catalogs (network shows per-catalog requests); grouping stays in catalogList order with NO reshuffle/jump.
  - Catalog chip: shows just that catalog. Price filter: applies. Search: loads all catalogs then filters. Special (new/top): shows correctly via single-query path.
  - Update-order menu: loads per-catalog, scrolls, loads more.
  - cart-validation still removes stale items; related-products slider renders; add-to-cart works.

## Out of scope / parallel
- BE: confirm `catalog + isTopSell/isNewProduct` semantics (returned 0 — is it "no data" or unsupported?). If supported, special filters could later join the per-catalog path.
- Image thumbnail resize — separate ticket; still the real fix for the scroll texture drop.
