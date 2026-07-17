# Menu infinite-scroll paging + new response envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Adapt to the new paged `/menu/specific` response envelope (BREAKING) and add infinite scroll to the Menu tab (and lighten the update-order menu load), while keeping every other `getSpecificMenu` consumer working.

**Architecture:** The endpoint now returns `result = { items: ISpecificMenu[], total, page, pageSize, totalPages, hasNext, hasPrevios }` — the actual menu items live in `result.items[].menuItems` (previously `result.menuItems`). A single helper flattens paged results to a menu-item array. The Menu tab and update-order list use `useInfiniteQuery`; "get everything" consumers (cart-validation, prefetch) omit `hasPaging` to receive all items in one page.

**Tech Stack:** React Native + Expo (Fabric ON), FlashList v2 (`maintainVisibleContentPosition` default-on), TanStack React Query v5 (`useInfiniteQuery`).

## Global Constraints

- No semicolons, single quotes, trailing commas, print width 80. TS strict. ESLint clean.
- **No commits** — working tree only.
- **Verified contract (sandbox, 2026-07-15):** `result` keys = `hasNext, hasPrevios (sic), items, total, page, pageSize, totalPages`. `result.items` is an array of menu objects (usually 1); each has `menuItems: IMenuItem[]` (the current page slice). Paging counts menuItems: page1 size5 → 5 items, total 15, totalPages 3, hasNext true; page3 hasNext false; no duplicates across pages.
- **Omitting `hasPaging` (or hasPaging=false) returns ALL items in one page** (pageSize=total, totalPages=1, hasNext=false).
- **BE does NOT sort menuItems by catalog** (mixed across pages). The catalog-grouped view relies on FlashList v2 `maintainVisibleContentPosition` to avoid visible jumps when later pages insert items into earlier catalog sections. A parallel BE request to sort menuItems by catalog would make this clean — track it, but this plan must work without it.
- Page size for infinite scroll: `MENU_PAGE_SIZE = 20`.

## File structure

- `types/menu.type.ts` — add `ISpecificMenuPaged`; extend `ISpecificMenuRequest` with `page?`, `size?`, `hasPaging?`.
- `api/menu.ts` — `getSpecificMenu`/`getPublicSpecificMenu` return `IApiResponse<ISpecificMenuPaged>`; add `extractMenuItems(res)` helper.
- `app/(tabs)/menu/index.tsx` — `useInfiniteQuery` + `onEndReached`.
- `app/update-order/components/update-order-menus.tsx` — `useInfiniteQuery` + `onEndReached`.
- `hooks/use-menu.ts`, `hooks/use-cart-validation.ts`, `hooks/use-predictive-prefetch.ts`, `components/menu/slider-related-products.tsx` — adapt to `extractMenuItems`.

---

### Task 1: Types + API envelope + helper

**Files:** `types/menu.type.ts`, `api/menu.ts`

- [ ] **Step 1:** In `types/menu.type.ts`, add:
```ts
export interface ISpecificMenuPaged {
  items: ISpecificMenu[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrevios?: boolean // BE spelling
}
```
Extend `ISpecificMenuRequest` with `page?: number`, `size?: number`, `hasPaging?: boolean`.

- [ ] **Step 2:** In `api/menu.ts`, change `getSpecificMenu` and `getPublicSpecificMenu` return types to `Promise<IApiResponse<ISpecificMenuPaged>>`. Add and export a pure helper:
```ts
/** Flatten the paged specific-menu envelope to a flat menu-item array. */
export function extractMenuItems(
  res: ISpecificMenuPaged | undefined | null,
): IMenuItem[] {
  return res?.items?.flatMap((m) => m.menuItems ?? []) ?? []
}
```
Keep `buildSpecificMenuRequest` as-is (it already spreads unknown fields through — confirm `page/size/hasPaging` are passed through; if it whitelists fields, add the three).

- [ ] **Step 3:** Verify: `npm run typecheck` will FAIL in consumers (expected — they still read `result.menuItems`). Run `npx eslint api/menu.ts types/menu.type.ts` → clean for these two files. Do not chase consumer errors here; Tasks 2-5 fix them.

---

### Task 2: Menu tab — useInfiniteQuery + onEndReached

**Files:** `app/(tabs)/menu/index.tsx`

- [ ] **Step 1:** Replace the two `useQuery` calls (private + public specific-menu) with `useInfiniteQuery`:
```ts
const {
  data: infiniteData,
  isFetching,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  refetch,
} = useInfiniteQuery({
  queryKey: [hasUser ? 'specific-menu' : 'public-specific-menu', request],
  queryFn: ({ pageParam }) =>
    (hasUser ? getSpecificMenu : getPublicSpecificMenu)({
      ...request,
      hasPaging: true,
      page: pageParam,
      size: MENU_PAGE_SIZE,
    }),
  initialPageParam: 1,
  getNextPageParam: (lastPage) =>
    lastPage.result?.hasNext ? (lastPage.result.page ?? 1) + 1 : undefined,
  enabled: hasBranch && allowFetch,
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  refetchOnMount: false,
  meta: { skipGlobalErrorCodes: [401, 403] },
})
```
(One infinite query keyed on `hasUser`; the private/public split is inside `queryFn`. Keep the `meta` from the earlier error-toast work.)

- [ ] **Step 2:** Derive the flat item list from all pages (replace `menuData?.result?.menuItems` in the `itemsRaw` memo):
```ts
const rawMenuItems = useMemo(
  () =>
    (infiniteData?.pages ?? []).flatMap((p) => extractMenuItems(p.result)),
  [infiniteData],
)
```
and change `itemsRaw`'s source from `menuData?.result?.menuItems ?? []` to `rawMenuItems`, dep `[rawMenuItems]`.

- [ ] **Step 3:** Add `onEndReached` to `<FlashList>`:
```ts
onEndReached={() => {
  if (hasNextPage && !isFetchingNextPage) fetchNextPage()
}}
onEndReachedThreshold={0.6}
```

- [ ] **Step 4:** Update `handleRefresh` to call the infinite `refetch()` (it refetches all loaded pages). Keep the `isRefreshing` state behavior.

- [ ] **Step 5:** Add `const MENU_PAGE_SIZE = 20` near the other module constants. Import `useInfiniteQuery` (replace `useQuery` import if now unused), `extractMenuItems`.

- [ ] **Step 6:** Verify: `npm run typecheck && npx eslint "app/(tabs)/menu/index.tsx"` clean. Manual device check required (see Task 6).

---

### Task 3: Update-order menu — useInfiniteQuery + onEndReached

**Files:** `app/update-order/components/update-order-menus.tsx`

- [ ] **Step 1:** Replace `useSpecificMenu`/`usePublicSpecificMenu` with `useInfiniteQuery` (mirror Task 2's shape, using this file's `menuRequest`, `shouldFetchAuth`/`shouldFetchPublic` → `enabled`). Derive `menuItems` via `pages.flatMap(p => extractMenuItems(p.result))`, then keep the existing sort/group logic.
- [ ] **Step 2:** Add `onEndReached`/`onEndReachedThreshold` to the FlashList (the list already scrolls after the virtualization fix). Wire `fetchNextPage`/`hasNextPage`/`isFetchingNextPage`.
- [ ] **Step 3:** Verify: `npm run typecheck && npx eslint "app/update-order/components/update-order-menus.tsx"` clean.

---

### Task 4: "Get everything" consumers — adapt envelope (no infinite scroll)

**Files:** `hooks/use-menu.ts`, `hooks/use-cart-validation.ts`, `components/menu/slider-related-products.tsx`

- [ ] **Step 1:** `hooks/use-menu.ts` (`useSpecificMenu`/`usePublicSpecificMenu`) now return `IApiResponse<ISpecificMenuPaged>`. These are used by update-order (migrated in Task 3) and slider-related-products. Keep them as plain `useQuery` returning the paged envelope; do NOT paginate here. (Their callers use `extractMenuItems`.)
- [ ] **Step 2:** `hooks/use-cart-validation.ts` reads `menuData?.result?.menuItems`. It needs the FULL menu → do NOT send `hasPaging`/page/size (omitting them returns all items in one page). Change its read to `extractMenuItems(menuData?.result)`.
- [ ] **Step 3:** `components/menu/slider-related-products.tsx` reads `result.menuItems` (via `useSpecificMenu`/`usePublicSpecificMenu`). Change to `extractMenuItems(data?.result)`. It shows a small related list — no infinite scroll needed.
- [ ] **Step 4:** Verify: `npm run typecheck && npx eslint hooks/use-menu.ts hooks/use-cart-validation.ts "components/menu/slider-related-products.tsx"` clean.

---

### Task 5: Prefetch — keep warming the first page

**Files:** `hooks/use-predictive-prefetch.ts`, `app/(tabs)/_layout.tsx`

- [ ] **Step 1:** The menu prefetches currently use `queryClient.prefetchQuery` with key `['specific-menu', menuRequest]`. Since the Menu tab now uses `useInfiniteQuery`, change these to `queryClient.prefetchInfiniteQuery` with `initialPageParam: 1` and the SAME queryKey + queryFn shape as Task 2 (so the prefetched cache matches the screen's infinite query). Keep `meta: { skipGlobalError: true }`.
- [ ] **Step 2:** Verify: `npm run typecheck && npx eslint hooks/use-predictive-prefetch.ts "app/(tabs)/_layout.tsx"` clean.

---

### Task 6: Full verification gate

- [ ] **Step 1:** `npm run typecheck && npm run lint` → both pass.
- [ ] **Step 2:** `grep -rn "result?.menuItems\|result.menuItems" app hooks components` → no matches (all migrated to `extractMenuItems`).
- [ ] **Step 3:** Manual device check (sandbox env) — REQUIRED:
  - Menu tab: items load; scrolling to the bottom loads more pages (network shows page=2,3…); reaching the end stops (hasNext=false).
  - Grouped "All" view: no visible jump/reshuffle while later pages load (maintainVisibleContentPosition). If it jumps badly → escalate the BE sort-by-catalog request.
  - Catalog filter + search: paginate/scroll cleanly (flat list).
  - Update-order menu: loads + scrolls + loads more.
  - Cart validation still works (add stale item → gets removed), related-products slider shows images, add-to-cart works.

## Out of scope / parallel

- **BE: sort `menuItems` by catalog** in the paged response — request in parallel; makes the grouped-view infinite scroll clean (removes reliance on maintainVisibleContentPosition). Not required for this plan to function.
- Image thumbnail resize (separate ticket `2026-07-15-product-image-thumbnail-resize.md`) — still the real fix for scroll texture drop; paging only lightens load/memory.
