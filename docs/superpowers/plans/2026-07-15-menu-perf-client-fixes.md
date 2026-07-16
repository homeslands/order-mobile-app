# Menu Performance — Client-Actionable Fixes (Packages 1+2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the client-side performance fixes from the menu audit — FlashList cleanup (Package 1) and smoother tab entry (Package 2). Infra-gated image downsizing (#1) is explicitly OUT OF SCOPE (needs a thumbnail service; separate research).

**Architecture:** All changes are in the Menu tab screen and its row component. Package 1 is behavior-preserving refactoring (dead-code removal, ref-stability, lazy computation). Package 2 changes the tab-entry sequence: stagger the image reveal across two frames, prefetch earlier, decouple data-fetch enablement from the image-reveal timer, and show a proper loading state during the cold-cache window.

**Tech Stack:** React Native + Expo (New Architecture / Fabric ON), @shopify/flash-list@2.0.2, expo-image, TanStack React Query v5.

## Global Constraints

- No semicolons, single quotes, trailing commas, print width 80 (Prettier).
- TypeScript strict — `npm run typecheck` must pass after every task.
- ESLint must pass on every changed file (no unused vars/imports).
- **No commits** — leave changes in the working tree only. Omit all `git commit` steps.
- Behavior-preserving tasks (1-3) must not change what the user sees; only reduce work.
- FlashList v2 auto-measures item size; `overrideItemLayout.size` is a no-op (verified in `node_modules/@shopify/flash-list/dist/FlashListProps.d.ts:179-181`). Do NOT add `estimatedItemSize` (removed in v2).
- Verified infra facts (do NOT act on them here): product images are 1080×1080 ~165KB JPEG on raw S3 with no `?w=` resize support. Image downsizing is infra work, not in this plan.

---

### Task 1: Remove dead `overrideItemLayout`

**Files:**
- Modify: `app/(tabs)/menu/index.tsx` (remove function, prop, and now-unused import)

**Rationale:** In FlashList v2 the `overrideItemLayout` callback only receives `{ span?: number }`; the `layout.size` this function writes is never read (v2 auto-measures per `getItemType` pool). It runs once per item per layout pass for zero effect.

- [ ] **Step 1: Delete the function** (`index.tsx:68-73`)

Remove:
```ts
function overrideItemLayout(
  layout: { span?: number; size?: number },
  item: FlatItem,
) {
  layout.size = item._kind === 'header' ? 40 : MENU_ITEM_ESTIMATED_HEIGHT
}

```

- [ ] **Step 2: Remove the FlashList prop** (`index.tsx:749`)

Remove this line from the `<FlashList ...>` props:
```ts
            overrideItemLayout={overrideItemLayout}
```

- [ ] **Step 3: Remove the now-unused import** (`index.tsx:56-61`)

Change:
```ts
import {
  MenuImagePhaseContext,
  MENU_ITEM_ESTIMATED_HEIGHT,
  MenuItemRow,
  menuViewabilityConfig,
} from './menu-item-row'
```
to:
```ts
import {
  MenuImagePhaseContext,
  MenuItemRow,
  menuViewabilityConfig,
} from './menu-item-row'
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npx eslint "app/(tabs)/menu/index.tsx"`
Expected: clean (no "MENU_ITEM_ESTIMATED_HEIGHT is defined but never used", no "overrideItemLayout" reference errors).

---

### Task 2: Stabilize `getItemType` and `refreshControl`

**Files:**
- Modify: `app/(tabs)/menu/index.tsx`

**Rationale:** `getItemType` (inline arrow) and the `refreshControl` element are new references on every `MenuPage` render (every keystroke, and twice per background refetch via `isFetching`/`isRefreshing`). FlashList's container is `React.memo`; new prop refs force a container reconcile mid-scroll. Rows don't re-render (their memo holds), but the container reconcile + fresh `RefreshControl` element is avoidable waste.

- [ ] **Step 1: Hoist `getItemType` to a module constant** (after `menuKeyExtractor`, `index.tsx:75-76`)

After:
```ts
const menuKeyExtractor = (item: FlatItem) =>
  item._kind === 'header' ? item.key : item.data.id
```
add:
```ts
const menuGetItemType = (item: FlatItem) => item._kind
```

- [ ] **Step 2: Memoize the `refreshControl` element** (after `handleRefresh`, `index.tsx:337`)

After the `handleRefresh` useCallback (ends at line 337), add:
```ts
  const refreshControlEl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        tintColor={primaryColor}
        colors={[primaryColor]}
      />
    ),
    [isRefreshing, handleRefresh, primaryColor],
  )
```

- [ ] **Step 3: Use the stable references in `<FlashList>`** (`index.tsx:748` and `:752-759`)

Change:
```ts
            getItemType={(item) => item._kind}
```
to:
```ts
            getItemType={menuGetItemType}
```

And change:
```ts
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={primaryColor}
                colors={[primaryColor]}
              />
            }
```
to:
```ts
            refreshControl={refreshControlEl}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npx eslint "app/(tabs)/menu/index.tsx"`
Expected: clean. (`useMemo` is already imported.)

---

### Task 3: Compute `heroImageUrls` lazily on navigation

**Files:**
- Modify: `app/(tabs)/menu/index.tsx` (itemsRaw transform + handleOpenDetail)
- Modify: `app/(tabs)/menu/menu-item-row.tsx` (MenuDisplayItem type)

**Rationale:** `heroImageUrls` is built for EVERY item in the `itemsRaw` memo (N × `getProductImageUrl` + array allocs on every real data change) but consumed only for the one item the user taps. `heroImagePaths` is already stored on the item, so the URLs can be derived at tap time.

- [ ] **Step 1: Drop `heroImageUrls` from the itemsRaw transform** (`index.tsx:375-377`)

In the returned object, remove:
```ts
        heroImageUrls: heroImagePaths
          .map((p) => getProductImageUrl(p))
          .filter((u): u is string => !!u),
```
(Keep `heroImagePaths` and everything else.)

- [ ] **Step 2: Derive the URLs inside `handleOpenDetail`** (`index.tsx:517-540`)

Change:
```ts
      // Hand hero image URLs via in-memory store instead of stringifying
      // through route params — same transition lifetime, zero serialization.
      useTransientNavStore
        .getState()
        .setHeroImageUrls(selectedItem.heroImageUrls ?? [])
```
to:
```ts
      // Hand hero image URLs via in-memory store instead of stringifying
      // through route params — computed lazily here (only the tapped item),
      // not eagerly for every list row.
      const heroImageUrls = selectedItem.heroImagePaths
        .map((p) => getProductImageUrl(p))
        .filter((u): u is string => !!u)
      useTransientNavStore.getState().setHeroImageUrls(heroImageUrls)
```

- [ ] **Step 3: Remove `heroImageUrls` from the `MenuDisplayItem` type** (`menu-item-row.tsx:28-29`)

Remove:
```ts
  /** Pre-computed hero image URLs — serialized lazily on navigation */
  heroImageUrls: string[]
```

- [ ] **Step 4: Confirm no other consumer of `heroImageUrls`**

Run: `grep -rn "heroImageUrls" app components hooks stores`
Expected: only the new local variable in `handleOpenDetail` (`index.tsx`). No property accesses on `MenuDisplayItem` anywhere else.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npx eslint "app/(tabs)/menu/index.tsx" "app/(tabs)/menu/menu-item-row.tsx"`
Expected: clean.

---

### Task 4: Smooth tab entry — staggered reveal, earlier prefetch, decoupled fetch, loading state

**Files:**
- Modify: `app/(tabs)/menu/index.tsx` (import, useFocusEffect, initial-prefetch effect, ListEmptyComponent)

**Rationale (four coupled changes to the entry sequence):**
1. The `imagePhaseCount` `0 → Infinity` flip re-renders ~8-10 mounted rows in ONE commit → ~8-10 concurrent JPEG decodes + texture uploads in a single frame (the only real frame-drop on the screen). Stagger it across two frames.
2. The initial 8-image prefetch is gated behind `imagePhaseCount`, so it starts at the same commit the rows mount (races the reveal). Decouple it so it warms the cache during the entry delay.
3. `allowFetch` gates BOTH the query and (via the timer) the image reveal, so on a cold cache the fetch can't start until after the 300ms image delay → data arrives later than necessary. Enable the query as soon as interactions settle; keep only the image reveal behind the delay.
4. During the cold-cache window (query not yet enabled / fetching, no data), the list shows the "empty catalog" logo state instead of a loading state — a wrong flash. Show loading until the query has run.

**⚠️ This task changes tab-entry timing — it MUST be verified on a device/simulator (Step 6), not just by typecheck.**

**Interfaces:**
- Consumes: `MENU_IMAGE_HIGH_PRIORITY_COUNT` (already exported from `./menu-item-row`, value 4).

- [ ] **Step 1: Import the high-priority count** (`index.tsx`, the `./menu-item-row` import — post-Task-1 state)

Change:
```ts
import {
  MenuImagePhaseContext,
  MenuItemRow,
  menuViewabilityConfig,
} from './menu-item-row'
```
to:
```ts
import {
  MENU_IMAGE_HIGH_PRIORITY_COUNT,
  MenuImagePhaseContext,
  MenuItemRow,
  menuViewabilityConfig,
} from './menu-item-row'
```

- [ ] **Step 2: Rewrite the focus effect to decouple fetch from the reveal and stagger the reveal** (`index.tsx:151-179`)

Replace the entire `useFocusEffect(useCallback(() => { ... }, []))` block (lines 151-179) with:
```ts
  useFocusEffect(
    useCallback(() => {
      setAllowFetch(false)
      const isFirstLoad = !hasLoadedImagesOnceRef.current
      if (isFirstLoad) setImagePhaseCount(0)

      let imageTimer: ReturnType<typeof setTimeout> | null = null
      const task = InteractionManager.runAfterInteractions(() => {
        // Enable the data fetch as soon as interactions settle (past the entry
        // animation) — NOT coupled to the image-reveal delay, so a cold cache
        // starts fetching ~300ms sooner.
        startTransition(() => setAllowFetch(true))

        if (!isFirstLoad) return
        // Defer the image reveal, then stagger it across two frames to avoid a
        // single-commit native decode/texture storm on first entry.
        imageTimer = setTimeout(() => {
          hasLoadedImagesOnceRef.current = true
          startTransition(() =>
            setImagePhaseCount(MENU_IMAGE_HIGH_PRIORITY_COUNT),
          )
          requestAnimationFrame(() =>
            startTransition(() => setImagePhaseCount(Number.MAX_SAFE_INTEGER)),
          )
        }, MENU_ENTRY_IMAGE_DELAY_MS)
      })

      return () => {
        task.cancel()
        if (imageTimer) clearTimeout(imageTimer)
        setAllowFetch(false)
      }
    }, []),
  )
```

- [ ] **Step 3: Remove the now-unused `MENU_ENTRY_FETCH_DELAY_MS` constant** (`index.tsx:80`)

Remove:
```ts
const MENU_ENTRY_FETCH_DELAY_MS = 120
```
(It was only used by the old first-load/return ternary, which is gone.)

- [ ] **Step 4: Decouple the initial 8-image prefetch from the phase gate** (`index.tsx:392-411`)

Change:
```ts
  const initialPrefetchDoneRef = React.useRef(false)
  useEffect(() => {
    if (imagePhaseCount === 0 || itemsRaw.length === 0) return
    if (initialPrefetchDoneRef.current) return
    initialPrefetchDoneRef.current = true
```
to:
```ts
  const initialPrefetchDoneRef = React.useRef(false)
  useEffect(() => {
    if (itemsRaw.length === 0) return
    if (initialPrefetchDoneRef.current) return
    initialPrefetchDoneRef.current = true
```
And change the dependency array at the end of that effect (`index.tsx:411`):
```ts
  }, [imagePhaseCount, itemsRaw])
```
to:
```ts
  }, [itemsRaw])
```

- [ ] **Step 5: Show a loading state during the cold window (memoized)** (`index.tsx` ListEmptyComponent, `:767-804`)

First, add a memoized empty-state element. After the `catalogHeaderColor` line (`index.tsx:597`), add:
```ts
  const isMenuLoading = !allowFetch || isFetching
  const listEmptyComponent = useMemo(() => {
    if (!isMenuLoading && !searchKeyword) {
      return (
        <View style={styles.catalogEmptyBox}>
          <Image
            source={Images.Brand.LogoIcon}
            contentFit="contain"
            style={styles.catalogEmptyLogo}
          />
          <Text
            style={[
              styles.catalogEmptyText,
              { color: isDark ? colors.gray[400] : colors.gray[500] },
            ]}
          >
            {t('menu.catalogEmpty')}
          </Text>
        </View>
      )
    }
    return (
      <View
        style={[
          styles.emptyBox,
          {
            backgroundColor: isDark ? colors.card.dark : colors.gray[100],
          },
        ]}
      >
        <Text style={styles.emptyText}>
          {isMenuLoading
            ? t('menu.loadingMenu')
            : searchKeyword
              ? t('menu.searchNotFound', { keyword: searchText })
              : t('menu.noMenuData')}
        </Text>
      </View>
    )
  }, [isMenuLoading, searchKeyword, searchText, isDark, t])
```

Then replace the inline `ListEmptyComponent={ ... }` prop (`index.tsx:767-804`) with:
```ts
            ListEmptyComponent={listEmptyComponent}
```

- [ ] **Step 6: Verify — automated + manual device check**

Automated: `npm run typecheck && npx eslint "app/(tabs)/menu/index.tsx"`
Expected: clean (no unused `MENU_ENTRY_FETCH_DELAY_MS`, no unused `imagePhaseCount` warning — it is still consumed by `<MenuImagePhaseContext.Provider value={imagePhaseCount}>`).

Manual (device/simulator — REQUIRED for this task):
1. **Cold entry** (kill app, pick a branch, open Menu): list text should appear as data arrives with a "loading" state first (NOT the empty-catalog logo flashing), then images fade in without a visible stall.
2. **Warm entry** (navigate away and back): images should already be present (no re-reveal), no empty flash.
3. **Fast fling** immediately after entry: no worse than before; blurhash → sharp as usual.

---

### Task 5: Final verification gate

**Files:** none (verification only)

- [ ] **Step 1: Whole quality gate**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 2: Confirm dead code is gone and stable refs are in place**

Run: `grep -n "overrideItemLayout\|MENU_ENTRY_FETCH_DELAY_MS\|heroImageUrls: string\|getItemType={(item)" "app/(tabs)/menu/index.tsx" "app/(tabs)/menu/menu-item-row.tsx"`
Expected: no matches (all removed/replaced).

- [ ] **Step 3: Confirm existing tests still pass**

Run: `npx jest __tests__/lib/global-error-gate.test.ts`
Expected: 5/5 pass (sanity that nothing global broke; no menu-specific unit tests exist).

---

## Out of scope (separate research)

- **#1 Image downsizing** — 1080×1080 sources into a 128pt cell. Requires an infra thumbnail path (server-side thumbnail on upload, or CloudFront+Lambda@Edge, or imgix/Cloudinary). Raw S3 does not support `?w=`. Once available: `getProductImageUrl(path, { maxWidth: 384 })` for the menu thumbnail only (keep full-res for detail hero). Track as a backend ticket.
- **#7** Redundant `useColorScheme` + prop-drilled `primaryColor` (minor; not included).
- Correctness/docs notes (double `initializeOrdering`, `handleOpenDetail` nav-lock bypass, CLAUDE.md GhostMount inaccuracy) — separate from performance.
