# On-device Thumbnail Resize — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render on-device-resized 384px thumbnails (instead of full-size S3 images) in the Menu tab and update-order menu lists, cached across sessions, to stop scroll frame drops without a backend change.

**Architecture:** Three isolated units — a persistent URL→file cache (MMKV), a resize service (`expo-image-manipulator` + `expo-file-system`, deduped/throttled), and a React hook — plus integration at two list-cell image components. Design: `docs/superpowers/specs/2026-07-16-on-device-thumbnail-resize-design.md`.

**Tech Stack:** React Native + Expo SDK 54, `expo-image-manipulator` (new), `expo-file-system/legacy`, `react-native-mmkv` (via `utils/storage.ts` `getMMKV()`), `expo-image`, jest.

## Global Constraints

- Prettier style: no semicolons, single quotes, trailing commas, print width 80.
- TypeScript strict — no `any`, explicit return types on exported functions.
- MMKV is native-only: all cache access must go through `getMMKV()` from `utils/storage.ts`, which returns `null` on web/SSR — every cache path must degrade gracefully when it is `null`.
- The list cell must render ONLY the local thumbnail (or the blurhash placeholder) — never the full remote URL in parallel (that reintroduces the jank + a double download).
- On any resize/download failure, fall back to the original remote URL (never a blank cell), and do not cache the failure.
- Integration is gated by `ON_DEVICE_RESIZE_ENABLED` (default `true`) so it can be killed without reverting.
- `IMAGE_PRESET.THUMB` (= 384) already exists in `utils/product-image-url.ts`; reuse it, do not hardcode 384 at call sites.

---

### Task 1: Add dependency + shared constants

**Files:**
- Modify: `package.json` (via installer)
- Create: `lib/image/resize-config.ts`

**Interfaces:**
- Produces: `RESIZE_CONCURRENCY: number`, `THUMBNAIL_CACHE_MAX: number`, `THUMBNAIL_JPEG_COMPRESS: number`, `ON_DEVICE_RESIZE_ENABLED: boolean`.

- [ ] **Step 1: Install expo-image-manipulator**

Run: `npx expo install expo-image-manipulator`
Expected: `expo-image-manipulator` added to `package.json` dependencies at an SDK-54-compatible version; `node_modules/expo-image-manipulator` present.

- [ ] **Step 2: Verify the installed manipulator API**

Run: `node -e "console.log(Object.keys(require('./node_modules/expo-image-manipulator')))"`
Expected: prints exported names. Confirm it includes `ImageManipulator` (context API) and `SaveFormat`. If it instead exposes legacy `manipulateAsync`, note it — Task 3 Step 3 has both call shapes; use the one that matches.

- [ ] **Step 3: Create the config module**

```ts
// lib/image/resize-config.ts

/** Master kill switch — flip to false to fall back to full-size remote images. */
export const ON_DEVICE_RESIZE_ENABLED = true

/** Max concurrent on-device resizes (bounds CPU during a scroll burst). */
export const RESIZE_CONCURRENCY = 3

/** Max cached thumbnail files before LRU eviction kicks in. */
export const THUMBNAIL_CACHE_MAX = 400

/** JPEG quality for saved thumbnails (0..1). */
export const THUMBNAIL_JPEG_COMPRESS = 0.8
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/image/resize-config.ts
git commit -m "chore(deps): add expo-image-manipulator + resize config"
```

---

### Task 2: Persistent thumbnail cache (MMKV index)

**Files:**
- Create: `lib/image/thumbnail-cache.ts`
- Test: `__tests__/image/thumbnail-cache.test.ts`

**Interfaces:**
- Consumes: `getMMKV` from `@/utils/storage`; `THUMBNAIL_CACHE_MAX` from `./resize-config`; `deleteAsync` from `expo-file-system/legacy`.
- Produces:
  - `thumbnailKey(remoteUrl: string, width: number): string`
  - `getCachedThumbnail(remoteUrl: string, width: number): string | null`
  - `putCachedThumbnail(remoteUrl: string, width: number, uri: string): void`
  - `invalidateThumbnail(remoteUrl: string, width: number): void`

Design: one in-memory `Map<key, { uri, ts }>` loaded lazily from a single MMKV JSON blob (`thumb-index-v1`). Reads hit the Map (sync, no pop-in). Writes update the Map, persist the blob, and evict the oldest files when over `THUMBNAIL_CACHE_MAX`.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/image/thumbnail-cache.test.ts
const store = new Map<string, string>()
jest.mock('@/utils/storage', () => ({
  getMMKV: () => ({
    getString: (k: string) => store.get(k),
    set: (k: string, v: string) => void store.set(k, v),
    remove: (k: string) => store.delete(k),
  }),
}))
const deleted: string[] = []
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: (uri: string) => {
    deleted.push(uri)
    return Promise.resolve()
  },
}))
jest.mock('@/lib/image/resize-config', () => ({ THUMBNAIL_CACHE_MAX: 3 }))

import {
  getCachedThumbnail,
  putCachedThumbnail,
  invalidateThumbnail,
  thumbnailKey,
} from '@/lib/image/thumbnail-cache'

beforeEach(() => {
  store.clear()
  deleted.length = 0
  jest.resetModules()
})

it('key differs by url and width', () => {
  expect(thumbnailKey('a', 384)).not.toBe(thumbnailKey('b', 384))
  expect(thumbnailKey('a', 384)).not.toBe(thumbnailKey('a', 768))
  expect(thumbnailKey('a', 384)).toBe(thumbnailKey('a', 384))
})

it('put then get round-trips', () => {
  putCachedThumbnail('http://x/a.jpg', 384, 'file://thumb-a.jpg')
  expect(getCachedThumbnail('http://x/a.jpg', 384)).toBe('file://thumb-a.jpg')
})

it('miss returns null', () => {
  expect(getCachedThumbnail('http://x/none.jpg', 384)).toBeNull()
})

it('evicts oldest file when over cap', () => {
  putCachedThumbnail('u1', 384, 'file://1')
  putCachedThumbnail('u2', 384, 'file://2')
  putCachedThumbnail('u3', 384, 'file://3')
  // touch u1 so it is newest-accessed
  getCachedThumbnail('u1', 384)
  putCachedThumbnail('u4', 384, 'file://4') // over cap (3) -> evict oldest (u2)
  expect(getCachedThumbnail('u2', 384)).toBeNull()
  expect(deleted).toContain('file://2')
  expect(getCachedThumbnail('u1', 384)).toBe('file://1')
})

it('invalidate removes entry and deletes file', () => {
  putCachedThumbnail('u1', 384, 'file://1')
  invalidateThumbnail('u1', 384)
  expect(getCachedThumbnail('u1', 384)).toBeNull()
  expect(deleted).toContain('file://1')
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx jest __tests__/image/thumbnail-cache.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the cache**

```ts
// lib/image/thumbnail-cache.ts
import { deleteAsync } from 'expo-file-system/legacy'

import { getMMKV } from '@/utils/storage'
import { THUMBNAIL_CACHE_MAX } from './resize-config'

const INDEX_KEY = 'thumb-index-v1'

type Entry = { uri: string; ts: number }
type Index = Record<string, Entry>

let index: Map<string, Entry> | null = null
let clock = 0

function load(): Map<string, Entry> {
  if (index) return index
  index = new Map()
  const mmkv = getMMKV()
  const raw = mmkv?.getString(INDEX_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Index
      for (const [k, v] of Object.entries(parsed)) index.set(k, v)
      for (const v of index.values()) if (v.ts > clock) clock = v.ts
    } catch {
      index = new Map()
    }
  }
  return index
}

function persist(map: Map<string, Entry>): void {
  const mmkv = getMMKV()
  if (!mmkv) return
  mmkv.set(INDEX_KEY, JSON.stringify(Object.fromEntries(map)))
}

/** Stable djb2 hash of `${url}|${width}` in base36. */
export function thumbnailKey(remoteUrl: string, width: number): string {
  const s = `${remoteUrl}|${width}`
  let h = 5381
  for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

export function getCachedThumbnail(
  remoteUrl: string,
  width: number,
): string | null {
  const map = load()
  const key = thumbnailKey(remoteUrl, width)
  const entry = map.get(key)
  if (!entry) return null
  clock += 1
  entry.ts = clock
  persist(map)
  return entry.uri
}

function evict(map: Map<string, Entry>): void {
  while (map.size > THUMBNAIL_CACHE_MAX) {
    let oldestKey: string | null = null
    let oldestTs = Infinity
    for (const [k, v] of map) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts
        oldestKey = k
      }
    }
    if (oldestKey == null) break
    const removed = map.get(oldestKey)
    map.delete(oldestKey)
    if (removed) deleteAsync(removed.uri, { idempotent: true }).catch(() => {})
  }
}

export function putCachedThumbnail(
  remoteUrl: string,
  width: number,
  uri: string,
): void {
  const map = load()
  clock += 1
  map.set(thumbnailKey(remoteUrl, width), { uri, ts: clock })
  evict(map)
  persist(map)
}

export function invalidateThumbnail(remoteUrl: string, width: number): void {
  const map = load()
  const key = thumbnailKey(remoteUrl, width)
  const removed = map.get(key)
  if (!removed) return
  map.delete(key)
  deleteAsync(removed.uri, { idempotent: true }).catch(() => {})
  persist(map)
}
```

Note: `deleteAsync` second arg `{ idempotent: true }` matches the legacy FS signature used in `utils/download-image.ts`. The test's mock ignores the options arg.

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx jest __tests__/image/thumbnail-cache.test.ts`
Expected: PASS (5/5). If the module-level `index`/`clock` leak state between tests, the test file calls `jest.resetModules()` in `beforeEach` — ensure the imports are inside the test file top-level (re-imported per reset is not needed since the Map is cleared via store.clear + fresh module state; if state leaks, switch the import to `require` inside each test).

- [ ] **Step 5: Commit**

```bash
git add lib/image/thumbnail-cache.ts __tests__/image/thumbnail-cache.test.ts
git commit -m "feat(image): persistent MMKV thumbnail cache with LRU eviction"
```

---

### Task 3: On-device resize service

**Files:**
- Create: `lib/image/on-device-resize.ts`
- Test: `__tests__/image/on-device-resize.test.ts`

**Interfaces:**
- Consumes: cache from `./thumbnail-cache`; config from `./resize-config`; `expo-image-manipulator`; `cacheDirectory`, `downloadAsync`, `makeDirectoryAsync`, `getInfoAsync`, `deleteAsync` from `expo-file-system/legacy`.
- Produces: `getThumbnailUri(remoteUrl: string, width: number): Promise<string>`.

Behavior: non-http → return input; `ON_DEVICE_RESIZE_ENABLED === false` → return input; cache hit → return it; in-flight dedupe per key; throttle to `RESIZE_CONCURRENCY`; download original → resize → save JPEG → cache → return local uri; on failure → return the original remote URL (uncached).

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/image/on-device-resize.test.ts
let resizeCalls = 0
jest.mock('@/lib/image/resize-config', () => ({
  ON_DEVICE_RESIZE_ENABLED: true,
  RESIZE_CONCURRENCY: 2,
  THUMBNAIL_JPEG_COMPRESS: 0.8,
}))
const cache: Record<string, string> = {}
jest.mock('@/lib/image/thumbnail-cache', () => ({
  getCachedThumbnail: (u: string) => cache[u] ?? null,
  putCachedThumbnail: (u: string, _w: number, uri: string) => {
    cache[u] = uri
  },
  invalidateThumbnail: jest.fn(),
}))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: () => Promise.resolve(),
  getInfoAsync: () => Promise.resolve({ exists: false }),
  downloadAsync: (_url: string, to: string) => Promise.resolve({ uri: to }),
  deleteAsync: () => Promise.resolve(),
}))
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: () => {},
      renderAsync: () =>
        Promise.resolve({
          saveAsync: () => {
            resizeCalls += 1
            return Promise.resolve({ uri: 'file:///cache/thumbs/out.jpg' })
          },
        }),
    }),
  },
}))

import { getThumbnailUri } from '@/lib/image/on-device-resize'

beforeEach(() => {
  resizeCalls = 0
  for (const k of Object.keys(cache)) delete cache[k]
})

it('non-http input returns unchanged, no resize', async () => {
  const r = await getThumbnailUri('some/local/asset', 384)
  expect(r).toBe('some/local/asset')
  expect(resizeCalls).toBe(0)
})

it('resizes a remote url and returns a local file', async () => {
  const r = await getThumbnailUri('http://s3/a.jpg', 384)
  expect(r).toBe('file:///cache/thumbs/out.jpg')
  expect(resizeCalls).toBe(1)
})

it('cache hit short-circuits (no resize)', async () => {
  cache['http://s3/a.jpg'] = 'file:///cache/thumbs/cached.jpg'
  const r = await getThumbnailUri('http://s3/a.jpg', 384)
  expect(r).toBe('file:///cache/thumbs/cached.jpg')
  expect(resizeCalls).toBe(0)
})

it('dedupes concurrent calls for the same url', async () => {
  const [a, b] = await Promise.all([
    getThumbnailUri('http://s3/dup.jpg', 384),
    getThumbnailUri('http://s3/dup.jpg', 384),
  ])
  expect(a).toBe(b)
  expect(resizeCalls).toBe(1)
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx jest __tests__/image/on-device-resize.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the resize service**

```ts
// lib/image/on-device-resize.ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy'

import {
  getCachedThumbnail,
  putCachedThumbnail,
  thumbnailKey,
} from './thumbnail-cache'
import {
  ON_DEVICE_RESIZE_ENABLED,
  RESIZE_CONCURRENCY,
  THUMBNAIL_JPEG_COMPRESS,
} from './resize-config'

const THUMB_DIR = `${cacheDirectory ?? ''}thumbs/`
const isHttp = (u: string) => /^https?:\/\//i.test(u)

const inflight = new Map<string, Promise<string>>()
let active = 0
const queue: Array<() => void> = []

function acquire(): Promise<void> {
  if (active < RESIZE_CONCURRENCY) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}

function release(): void {
  active -= 1
  const next = queue.shift()
  if (next) {
    active += 1
    next()
  }
}

let dirReady: Promise<void> | null = null
function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = makeDirectoryAsync(THUMB_DIR, { intermediates: true }).catch(
      () => {},
    )
  }
  return dirReady
}

async function resize(remoteUrl: string, width: number): Promise<string> {
  await ensureDir()
  const key = thumbnailKey(remoteUrl, width)
  const tmp = `${THUMB_DIR}${key}.src`
  await acquire()
  try {
    const info = await getInfoAsync(tmp)
    if (!info.exists) await downloadAsync(remoteUrl, tmp)
    const ctx = ImageManipulator.manipulate(tmp)
    ctx.resize({ width })
    const image = await ctx.renderAsync()
    const out = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: THUMBNAIL_JPEG_COMPRESS,
    })
    deleteAsync(tmp, { idempotent: true }).catch(() => {})
    putCachedThumbnail(remoteUrl, width, out.uri)
    return out.uri
  } finally {
    release()
  }
}

/**
 * Returns a local resized thumbnail uri for a remote image, or the original
 * url on non-http input / disabled flag / failure. Deduped + throttled.
 */
export function getThumbnailUri(
  remoteUrl: string,
  width: number,
): Promise<string> {
  if (!ON_DEVICE_RESIZE_ENABLED || !remoteUrl || !isHttp(remoteUrl)) {
    return Promise.resolve(remoteUrl)
  }
  const cached = getCachedThumbnail(remoteUrl, width)
  if (cached) return Promise.resolve(cached)

  const key = thumbnailKey(remoteUrl, width)
  const existing = inflight.get(key)
  if (existing) return existing

  const task = resize(remoteUrl, width)
    .catch(() => remoteUrl)
    .finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}
```

Note (verified in Task 1 Step 2): if the installed manipulator exposes only the legacy `manipulateAsync(uri, actions, options)`, replace the `ImageManipulator.manipulate(...)` block with:
`const out = await manipulateAsync(tmp, [{ resize: { width } }], { compress: THUMBNAIL_JPEG_COMPRESS, format: SaveFormat.JPEG })`.

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx jest __tests__/image/on-device-resize.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add lib/image/on-device-resize.ts __tests__/image/on-device-resize.test.ts
git commit -m "feat(image): on-device resize service (dedupe + throttle + fallback)"
```

---

### Task 4: useThumbnailUri hook

**Files:**
- Create: `hooks/use-thumbnail-uri.ts`
- Test: `__tests__/image/use-thumbnail-uri.test.tsx`

**Interfaces:**
- Consumes: `getCachedThumbnail` from `@/lib/image/thumbnail-cache`; `getThumbnailUri` from `@/lib/image/on-device-resize`; `IMAGE_PRESET` optional (caller passes width).
- Produces: `useThumbnailUri(remoteUrl: string | null, width: number): string | null`.

Behavior: sync cache-hit → initial state is the local uri (no pop-in); miss → `null`, resolve async and setState; ignore stale resolutions on url change; no setState after unmount.

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/image/use-thumbnail-uri.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react-native'

let resolveResize: (v: string) => void = () => {}
jest.mock('@/lib/image/thumbnail-cache', () => ({
  getCachedThumbnail: (u: string) =>
    u === 'http://s3/cached.jpg' ? 'file://cached.jpg' : null,
}))
jest.mock('@/lib/image/on-device-resize', () => ({
  getThumbnailUri: (u: string) =>
    new Promise<string>((res) => {
      resolveResize = res
      if (u === 'http://s3/immediate.jpg') res('file://done.jpg')
    }),
}))

import { useThumbnailUri } from '@/hooks/use-thumbnail-uri'

it('returns cached uri synchronously on first render', () => {
  const { result } = renderHook(() =>
    useThumbnailUri('http://s3/cached.jpg', 384),
  )
  expect(result.current).toBe('file://cached.jpg')
})

it('returns null then resolved uri on miss', async () => {
  const { result } = renderHook(() =>
    useThumbnailUri('http://s3/immediate.jpg', 384),
  )
  expect(result.current).toBeNull()
  await waitFor(() => expect(result.current).toBe('file://done.jpg'))
})

it('returns null for null url', () => {
  const { result } = renderHook(() => useThumbnailUri(null, 384))
  expect(result.current).toBeNull()
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx jest __tests__/image/use-thumbnail-uri.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

```ts
// hooks/use-thumbnail-uri.ts
import { useEffect, useState } from 'react'

import { getThumbnailUri } from '@/lib/image/on-device-resize'
import { getCachedThumbnail } from '@/lib/image/thumbnail-cache'

/**
 * Resolve a remote image url to a local resized thumbnail uri.
 * Cache hits resolve synchronously (no pop-in); misses resolve after resize.
 */
export function useThumbnailUri(
  remoteUrl: string | null,
  width: number,
): string | null {
  const [uri, setUri] = useState<string | null>(() =>
    remoteUrl ? getCachedThumbnail(remoteUrl, width) : null,
  )

  useEffect(() => {
    if (!remoteUrl) {
      setUri(null)
      return
    }
    const hit = getCachedThumbnail(remoteUrl, width)
    if (hit) {
      setUri(hit)
      return
    }
    setUri(null)
    let alive = true
    getThumbnailUri(remoteUrl, width).then((resolved) => {
      if (alive) setUri(resolved)
    })
    return () => {
      alive = false
    }
  }, [remoteUrl, width])

  return uri
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx jest __tests__/image/use-thumbnail-uri.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add hooks/use-thumbnail-uri.ts __tests__/image/use-thumbnail-uri.test.tsx
git commit -m "feat(image): useThumbnailUri hook"
```

---

### Task 5: Integrate into the Menu tab list cell

**Files:**
- Modify: `components/menu/menu-item-image.tsx`

**Interfaces:**
- Consumes: `useThumbnailUri` from `@/hooks/use-thumbnail-uri`; `IMAGE_PRESET` from `@/utils/product-image-url`.

Current (relevant part): when `isEnabled` and `imageUrl` present, it renders `<Image source={{ uri: imageUrl }} ... />` with `MENU_ITEM_BLURHASH` placeholder. Change: resolve `imageUrl` through `useThumbnailUri`; render the thumbnail; while pending, keep showing the blurhash (source `null`); on load error, invalidate + fall back to remote.

- [ ] **Step 1: Add the hook + thumbnail source**

In `components/menu/menu-item-image.tsx`, add imports:

```ts
import { useThumbnailUri } from '@/hooks/use-thumbnail-uri'
import { IMAGE_PRESET } from '@/utils/product-image-url'
import { invalidateThumbnail } from '@/lib/image/thumbnail-cache'
```

Because hooks cannot run after the early `return`s, move the hook to the top of `MenuItemImageBase` (before the `!isEnabled` / `!imageUrl` guards). Compute it only for real remote urls:

```ts
const thumb = useThumbnailUri(
  isEnabled && imageUrl ? imageUrl : null,
  IMAGE_PRESET.THUMB,
)
```

Then in the final remote-image branch, replace:

```ts
    <Image
      source={{ uri: imageUrl }}
```

with:

```ts
    <Image
      source={thumb ? { uri: thumb } : null}
      onError={() => {
        if (imageUrl) invalidateThumbnail(imageUrl, IMAGE_PRESET.THUMB)
      }}
```

Keep the existing `placeholder={MENU_ITEM_BLURHASH}`, `recyclingKey`, `cachePolicy`, `priority`, `allowDownscaling`, `enforceEarlyResizing`, `contentFit`, style. The blurhash shows while `thumb` is `null`.

- [ ] **Step 2: Verify the parallel-load constraint**

Confirm the branch no longer references `{ uri: imageUrl }` as the source anywhere (only `thumb`), so the full remote image is never loaded by the cell. `grep -n "uri: imageUrl" components/menu/menu-item-image.tsx` → Expected: no matches.

- [ ] **Step 3: Typecheck + lint**

Run: `npm run check`
Expected: PASS. (Hook is now above the early returns → no conditional-hook lint error.)

- [ ] **Step 4: Commit**

```bash
git add components/menu/menu-item-image.tsx
git commit -m "perf(menu): render on-device 384px thumbnails in menu list cells"
```

---

### Task 6: Integrate into the update-order menu list cell

**Files:**
- Modify: `app/update-order/components/client-menu-item-for-update-order.tsx`

**Interfaces:**
- Consumes: `useThumbnailUri`, `IMAGE_PRESET`, `invalidateThumbnail` (as Task 5).

This file already computes `const imageUrl = getProductImageUrl(item.product.image, { maxWidth: IMAGE_PRESET.THUMB })` and renders an `expo-image` with it. Apply the same swap as Task 5.

- [ ] **Step 1: Locate the image render**

Run: `grep -n "imageUrl\|<Image\|source=" app/update-order/components/client-menu-item-for-update-order.tsx`
Expected: find the `expo-image` `<Image source={{ uri: imageUrl }} ... />` (or equivalent) and its placeholder.

- [ ] **Step 2: Apply the thumbnail swap**

Add imports:

```ts
import { useThumbnailUri } from '@/hooks/use-thumbnail-uri'
import { invalidateThumbnail } from '@/lib/image/thumbnail-cache'
```

(`IMAGE_PRESET` is already imported in this file.) At the top of the component body (before any early return), add:

```ts
const thumb = useThumbnailUri(imageUrl ?? null, IMAGE_PRESET.THUMB)
```

Replace the image's `source={{ uri: imageUrl }}` with:

```ts
        source={thumb ? { uri: thumb } : null}
        onError={() => {
          if (imageUrl) invalidateThumbnail(imageUrl, IMAGE_PRESET.THUMB)
        }}
```

Keep the existing placeholder/blurhash and other props. If the file currently has no placeholder, add `placeholder={Images.Food.DefaultProductImage}` (import `Images` from `@/assets/images` if not present) so a pending resize is not blank.

- [ ] **Step 3: Verify the parallel-load constraint**

Run: `grep -n "uri: imageUrl" app/update-order/components/client-menu-item-for-update-order.tsx`
Expected: no matches (only `thumb` is the source).

- [ ] **Step 4: Typecheck + lint + full test**

Run: `npm run check && npm test`
Expected: typecheck PASS, lint PASS, all jest suites PASS (existing update-order-menus test still green — it mocks `useCatalogMenuPages` and the child menu item, so the hook does not run in that test; if the child is rendered unmocked anywhere, add a `jest.mock('@/hooks/use-thumbnail-uri', () => ({ useThumbnailUri: (u: string | null) => u }))` to that suite).

- [ ] **Step 5: Commit**

```bash
git add app/update-order/components/client-menu-item-for-update-order.tsx
git commit -m "perf(update-order): render on-device 384px thumbnails in menu list"
```

---

## Post-implementation (device verification — cannot be done in CI)

- Build on a mid-tier Android device. Load the Menu tab; scroll fast + slow through fully-loaded images. Expected: smooth (no repeated frame drops on re-scroll). First view of each image shows blurhash briefly then the thumbnail; subsequent app launches show thumbnails instantly.
- Repeat in the update-order menu.
- Confirm on iOS: no regression, images correct.
- If anything misbehaves, set `ON_DEVICE_RESIZE_ENABLED = false` in `lib/image/resize-config.ts` to fall back.

## Self-review notes

- Spec coverage: cache (Task 2), resize service (Task 3), hook (Task 4), two integrations (Tasks 5–6), dependency + config + kill switch (Task 1). All spec sections mapped.
- Type consistency: `getThumbnailUri(url, width)`, `getCachedThumbnail(url, width)`, `useThumbnailUri(url|null, width)`, `invalidateThumbnail(url, width)` used identically across tasks.
- The manipulator API shape is confirmed in Task 1 Step 2 before Task 3 uses it, with a legacy fallback documented.
