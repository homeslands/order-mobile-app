# On-device Thumbnail Resize — Design

**Date:** 2026-07-16
**Status:** Approved (design)
**Related:** docs/tickets/2026-07-15-product-image-thumbnail-resize.md (backend fix — blocked, not soon)

## Problem

Product images are served at full resolution (up to 1080×1080) from raw S3 with **no server-side resize** (`?w=` ignored). List cells display them at ~384px, so the GPU composites/uploads ~1080px textures every frame during scroll → dropped frames on Android. `expo-image`'s `allowDownscaling` + `enforceEarlyResizing` are already enabled and are **not sufficient** on Android for these source sizes (confirmed in the ticket via isolation testing). Backend thumbnails are the real fix but are **not available soon**, so we need a **FE-only** mitigation.

## Goal

Make the **Menu tab** and **update-order menu** lists scroll smoothly (both iOS + Android) by rendering **on-device-resized 384px thumbnails** instead of the full-size remote images, with results cached across sessions.

## Non-goals

- Reducing network payload (server only has full-size; we still download it once per image).
- Backend changes.
- Applying to gift-card / order-history / payment lists (later, if needed).
- Resizing the detail-screen HERO image (it is shown large; out of scope).

## Approach (chosen)

Download each remote image once, resize to 384px on-device (`expo-image-manipulator`), persist the resized file, and render **only the local resized file** in the list cell. Alternatives rejected: forcing a smaller decode via expo-image flags (already maxed, insufficient on Android); swapping image libraries (same texture cost).

## Architecture

Three isolated units + integration at two call sites.

### 1. `lib/image/thumbnail-cache.ts` — persistent URL→file map

Responsibility: remember which remote URL maps to which local resized file, with bounded storage.

- Backed by **MMKV** (`react-native-mmkv`, already a dependency) — synchronous reads so a cache hit resolves without a pop-in.
- Key: a stable hash of `${remoteUrl}|${width}` (so different widths don't collide).
- Value: `{ uri: string; ts: number }` (ts = last-access, for LRU).
- API:
  - `getCached(remoteUrl, width): string | null` — returns local uri if mapped AND the file still exists; refreshes `ts`.
  - `putCached(remoteUrl, width, uri): void` — stores mapping, triggers eviction if over cap.
  - `evictIfNeeded(): void` — when entries exceed `THUMBNAIL_CACHE_MAX` (default **400**), delete the oldest files + their map entries down to ~80% of cap.
- On store/evict, delete the underlying files via `expo-file-system` so the directory does not grow unbounded.

### 2. `lib/image/on-device-resize.ts` — the resize service

Responsibility: given a remote URL, produce a local 384px file (idempotent, deduped, throttled).

- `getThumbnailUri(remoteUrl: string, width = 384): Promise<string>`:
  1. Non-http (bundled/local) or empty → return the input unchanged (no resize).
  2. `thumbnailCache.getCached` hit → return it.
  3. In-flight dedupe: if a Promise for this key is pending, return it (a `Map<string, Promise<string>>`).
  4. Throttle: at most `RESIZE_CONCURRENCY` (default **3**) resizes run at once; the rest queue.
  5. Resize: download original to a temp file (`expo-file-system`), run `expo-image-manipulator` resize to `{ width }`, save JPEG (`compress: 0.8`) into `${cacheDirectory}thumbs/<hash>.jpg`, delete the temp original.
  6. `putCached`, resolve local uri.
  7. On any failure → resolve the **original remote URL** (degrade to un-resized rather than blank), and do NOT cache the failure.
- The exact `expo-image-manipulator` API (context-based `manipulate()` in SDK 54 vs legacy `manipulateAsync`) and whether it accepts a remote URI directly is verified during implementation against the installed version; the download-first path above is the robust default.

### 3. `hooks/use-thumbnail-uri.ts` — the React hook

Responsibility: expose the thumbnail uri to a component with correct loading/cancel behavior.

- `useThumbnailUri(remoteUrl: string | null, width = 384): string | null`:
  - Synchronous cache check on first render → if hit, initial state is the local uri (no pop-in, no flash).
  - On miss → state `null`, kick off `getThumbnailUri` in an effect; `setState` when it resolves.
  - Guard against setState after unmount and re-run when `remoteUrl` changes (ignore stale resolutions).
  - `null` remote → returns `null`.

### 4. Integration (two call sites)

- `components/menu/menu-item-image.tsx`: replace the remote `source={{ uri: imageUrl }}` with `const thumb = useThumbnailUri(imageUrl, IMAGE_PRESET.THUMB)`; render `source={ thumb ? { uri: thumb } : null }`, keep the existing `MENU_ITEM_BLURHASH` placeholder so a pending resize shows the blurhash. Preserve the `isEnabled` phase-gate — the hook is only mounted/active when `isEnabled` is true, so resizing never runs during the tab entry animation.
- Update-order menu image (`app/update-order/components/client-menu-item-for-update-order.tsx`): same swap for its list-cell image.
- **Critical:** the cell must NOT also load the remote full URL in parallel (that reintroduces the jank + double download). Only the local thumb (or blurhash placeholder) is rendered.

## Data flow

Cell mounts → (phase-gate enabled) → `useThumbnailUri(url, 384)` → MMKV hit ⇒ small local file shown immediately; miss ⇒ blurhash shown, service downloads+resizes once, hook updates, small file shown (one-time pop-in). Scroll shows only small local textures ⇒ smooth. Next session ⇒ MMKV hit ⇒ instant.

## Constants (tunable)

- `IMAGE_PRESET.THUMB = 384` (already defined in `utils/product-image-url.ts`).
- `RESIZE_CONCURRENCY = 3`.
- `THUMBNAIL_CACHE_MAX = 400` files.
- JPEG `compress = 0.8`.

## Error handling

- Resize/download failure → fall back to original remote URL (not blank); do not cache.
- Missing cached file (evicted/deleted out-of-band) → treated as miss, re-resized.
- MMKV read error → treated as miss.

## Testing

Unit-testable (jest, mocking `expo-image-manipulator`, `expo-file-system`, `react-native-mmkv`):
- `thumbnail-cache`: hash keying, put/get round-trip, `ts` refresh on read, eviction over cap (oldest removed, files deleted), missing-file treated as miss.
- `on-device-resize`: cache-hit short-circuit, in-flight dedupe (two concurrent calls → one resize), non-http bypass, failure → original URL fallback (uncached).
- `use-thumbnail-uri`: cache-hit → immediate uri; miss → null then uri; url change → ignores stale resolution; unmount → no setState.

Native resize correctness (actual pixel output, real smoothness) verified on device — cannot be unit-tested.

## Rollout / kill switch

Gate integration behind a single constant `ON_DEVICE_RESIZE_ENABLED` (default `true`) in `lib/image/on-device-resize.ts`, so if the resize path misbehaves on device it can be turned off (cells fall back to the current remote-image behavior) without reverting the integration.

## Dependency

Add `expo-image-manipulator` (Expo SDK 54-compatible version via `npx expo install`).
