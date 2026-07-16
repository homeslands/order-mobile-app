# Centralize product-image URLs onto `getProductImageUrl` (prep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Migrate every screen that builds a product-image display URL by hand to the single source of truth `getProductImageUrl(path, { maxWidth? })`, so that when a resize service later lands, one util change resizes all screens. **This is a behavior-preserving refactor — it does NOT fix the scroll drop yet** (no resize backend exists).

**Architecture:** `utils/product-image-url.ts` already exists. Replace hand-built `` `${publicFileURL}/${image}` `` strings (and files that reimplement the util's logic verbatim) with `getProductImageUrl(...)`. Preserve each site's null/empty → fallback behavior exactly.

**Tech Stack:** React Native + Expo, expo-image.

## Global Constraints

- No semicolons, single quotes, trailing commas, print width 80 (Prettier).
- TypeScript strict — `npm run typecheck` must pass after every task.
- ESLint must pass on every changed file (remove now-unused `publicFileURL` imports).
- **No commits** — working tree only. Omit all `git commit` steps.
- **Behavior-preserving.** For a normal S3 path (`abc.jpg`, no scheme, no leading slash), `getProductImageUrl(path)` returns exactly `` `${publicFileURL}/abc.jpg` `` — identical to the hand-built string. It ALSO correctly handles `http(s)://` passthrough, slash normalization, and `null`/empty → `null` (strictly more correct). Do NOT pass `maxWidth` (no resize backend yet) — behavior must be identical to today.
- **Preserve fallbacks.** Where a site does `image ? { uri: url } : DefaultImage`, keep it as `getProductImageUrl(image) ? { uri: getProductImageUrl(image)! } : DefaultImage` (compute once into a variable, don't call twice).
- Do NOT change files that only store the raw path into a data object (not a display URL): `menu-item-quantity-control.tsx`, `app/(tabs)/menu/product/[id].tsx`, `app/order/[id].tsx`. Out of scope.

## Migration rule (applies to every task)

1. Import `getProductImageUrl` from `@/utils/product-image-url`.
2. Replace the hand-built URL (`` `${publicFileURL}/${image}` ``) or the reimplemented `useMemo`/helper with `getProductImageUrl(image)`.
3. Preserve the exact null/fallback behavior (compute the URL into a local/`useMemo`, then branch on it).
4. Remove the `publicFileURL` import if it is no longer referenced in the file.
5. Verify: `npm run typecheck` + `npx eslint <file>` clean; and reason that the produced URL is identical for normal paths.

---

### Task 1: Update-order screens

**Files:**
- Modify: `app/update-order/components/client-menu-item-for-update-order.tsx` (~line 45-46: `` item.product.image ? `${publicFileURL}/${item.product.image}` : … ``)
- Modify: `app/update-order/components/update-order-content-native.tsx` (~line 198: `` item.image ? `${publicFileURL}/${item.image}` : null ``)

- [ ] **Step 1:** In each file, import `getProductImageUrl` and replace the hand-built URL per the Migration rule. `update-order-content-native` uses `item.image` (order-item image path) — `getProductImageUrl(item.image)` handles it the same way.
- [ ] **Step 2:** Remove the now-unused `publicFileURL` import from each file if nothing else uses it (grep the file for `publicFileURL` first).
- [ ] **Step 3:** Verify: `npm run typecheck && npx eslint "app/update-order/components/client-menu-item-for-update-order.tsx" "app/update-order/components/update-order-content-native.tsx"` → clean.

---

### Task 2: Order-history & payment item rows

**Files:**
- Modify: `app/payment/payment-product-item.tsx` (~line 95-96: `` item.variant?.product?.image ? { uri: `${publicFileURL}/${item.variant.product.image}` } : <default> ``)
- Modify: `app/profile/order-product-item.tsx` (~line 99-100: `` product.variant?.product?.image ? { uri: `${publicFileURL}/${product.variant.product.image}` } : <default> ``)

- [ ] **Step 1:** In each file, import `getProductImageUrl`. Compute the URL once (e.g. `const imageUrl = getProductImageUrl(item.variant?.product?.image)`), then use `imageUrl ? { uri: imageUrl } : <existing default source>`. Keep the existing default-image fallback exactly.
- [ ] **Step 2:** Remove the now-unused `publicFileURL` import if no longer referenced.
- [ ] **Step 3:** Verify: `npm run typecheck && npx eslint "app/payment/payment-product-item.tsx" "app/profile/order-product-item.tsx"` → clean.

---

### Task 3: Menu components that reimplement the util

**Files:**
- Modify: `components/menu/client-menu-item.tsx` (~line 55-64: a `useMemo` that reimplements trim / `http` passthrough / base / slash-normalize — identical to `getProductImageUrl`. Also ~line 96-101 builds a hero-image list from `product.images` the same way.)
- Modify: `components/menu/slider-related-products.tsx` (~line 67-75: same reimplemented `useMemo`. Also ~line 279-286 builds a hero list.)

- [ ] **Step 1:** Replace the reimplemented `imageUrl` `useMemo` body with `getProductImageUrl(item.product.image)` (keep it wrapped in `useMemo` with the same dep `[item.product.image]` to preserve reference stability). Import `getProductImageUrl`.
- [ ] **Step 2:** For the hero-image-list construction (`[product.image, ...product.images]` → URLs), map each path through `getProductImageUrl` and filter truthy — same output as the current manual `` `${base}/${path}` `` mapping.
- [ ] **Step 3:** Remove the now-unused `publicFileURL` import if no longer referenced (note: these files may still use `publicFileURL` elsewhere — grep first, only remove if truly unused).
- [ ] **Step 4:** Verify: `npm run typecheck && npx eslint "components/menu/client-menu-item.tsx" "components/menu/slider-related-products.tsx"` → clean.

---

### Task 4: Verification gate

- [ ] **Step 1:** `npm run typecheck && npm run lint` → both pass.
- [ ] **Step 2:** Confirm no hand-built product-image URLs remain in the migrated files: `grep -rn "publicFileURL}/" app/update-order app/payment app/profile components/menu` → no matches (the only remaining `publicFileURL` uses, if any, must be non-product or genuinely different).

## Out of scope (needs the resize service — separate ticket)

- Routing `getProductImageUrl` through a resize service + passing `THUMB`/`HERO` presets. Tracked in `docs/tickets/2026-07-15-product-image-thumbnail-resize.md`. This plan only centralizes the call sites so that step becomes a one-place change.
