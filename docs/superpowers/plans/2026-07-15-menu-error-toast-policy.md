# Menu Error-Toast Policy (B′ + siết) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the false "Không có quyền truy cập, vui lòng đăng nhập lại" toast when entering the Menu tab, without suppressing genuine (500 / other) errors.

**Architecture:** The global React Query error handler currently offers only an all-or-nothing `skipGlobalError` flag. We add a targeted `skipGlobalErrorCodes: number[]` option in one pure, unit-tested gate function. Invisible background prefetches get blanket suppression; visible menu queries suppress only the self-healing auth codes (401/403) so real infra errors still toast.

**Tech Stack:** React Native + Expo, TanStack React Query v5, Zustand, Jest (jest-expo).

## Global Constraints

- No semicolons, single quotes, trailing commas, print width 80 (Prettier).
- TypeScript strict mode — `npm run typecheck` must pass.
- ESLint must pass on every changed file.
- **No commits** — the user requested this explicitly. Omit all `git commit` steps.
- React Query `meta` is `Record<string, unknown>` — no type augmentation needed to add custom keys.
- Auth codes to treat as "self-healing" (menu falls back to public): `[401, 403]`.

---

### Task 1: Targeted error-gate (pure function + tests)

**Files:**
- Create: `lib/global-error-gate.ts`
- Modify: `lib/query-client.ts:13-37` (import the gate, replace inline logic)
- Test: `__tests__/lib/global-error-gate.test.ts`

**Interfaces:**
- Produces: `extractStatusCode(error: unknown): number | null`
- Produces: `resolveGlobalErrorCode(meta: Record<string, unknown> | undefined, error: unknown): number | null` — returns the HTTP code to toast, or `null` when the global toast must be skipped.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/global-error-gate.test.ts`:

```ts
import { resolveGlobalErrorCode } from '@/lib/global-error-gate'

const withCode = (statusCode: number) => ({
  response: { data: { statusCode } },
})
const networkError = new Error('Network Error')

describe('resolveGlobalErrorCode', () => {
  it('skips everything when skipGlobalError is true', () => {
    expect(
      resolveGlobalErrorCode({ skipGlobalError: true }, withCode(500)),
    ).toBeNull()
  })

  it('skips a code listed in skipGlobalErrorCodes', () => {
    expect(
      resolveGlobalErrorCode({ skipGlobalErrorCodes: [401, 403] }, withCode(401)),
    ).toBeNull()
  })

  it('returns a code NOT listed in skipGlobalErrorCodes', () => {
    expect(
      resolveGlobalErrorCode({ skipGlobalErrorCodes: [401, 403] }, withCode(500)),
    ).toBe(500)
  })

  it('returns the code when there is no meta', () => {
    expect(resolveGlobalErrorCode(undefined, withCode(500))).toBe(500)
  })

  it('returns null for a network error with no status code', () => {
    expect(resolveGlobalErrorCode(undefined, networkError)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/global-error-gate.test.ts`
Expected: FAIL — `Cannot find module '@/lib/global-error-gate'`.

- [ ] **Step 3: Create the gate implementation**

Create `lib/global-error-gate.ts`:

```ts
/**
 * Pure gate for the global React Query error toast.
 *
 * - `skipGlobalError: true` — suppress the toast for ALL error codes (used by
 *   invisible background prefetches).
 * - `skipGlobalErrorCodes: number[]` — suppress the toast only for the listed
 *   codes (used by visible menu queries: [401, 403] are self-healing auth
 *   states that fall back to the public menu, so they must not toast — but a
 *   real 500 / network error still surfaces).
 */
export function extractStatusCode(error: unknown): number | null {
  const err = error as {
    response?: { data?: { statusCode?: number; code?: number } }
  }
  return err?.response?.data?.statusCode ?? err?.response?.data?.code ?? null
}

export function resolveGlobalErrorCode(
  meta: Record<string, unknown> | undefined,
  error: unknown,
): number | null {
  if (meta?.skipGlobalError) return null
  const code = extractStatusCode(error)
  if (code == null) return null
  const skipCodes = meta?.skipGlobalErrorCodes as number[] | undefined
  if (skipCodes?.includes(code)) return null
  return code
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/global-error-gate.test.ts`
Expected: PASS — 5 passing.

- [ ] **Step 5: Wire the gate into query-client.ts**

In `lib/query-client.ts`, replace the import + `extractStatusCode` + both `onError` bodies.

Replace this:

```ts
import { showErrorToast } from '@/utils/toast'

function extractStatusCode(error: unknown): number | null {
  const err = error as {
    response?: { data?: { statusCode?: number; code?: number } }
  }
  return err?.response?.data?.statusCode ?? err?.response?.data?.code ?? null
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipGlobalError) return
      const code = extractStatusCode(error)
      if (code) showErrorToast(code)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return
      if (mutation.meta?.skipGlobalError) return
      const code = extractStatusCode(error)
      if (code) showErrorToast(code)
    },
  }),
```

With this:

```ts
import { resolveGlobalErrorCode } from '@/lib/global-error-gate'
import { showErrorToast } from '@/utils/toast'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const code = resolveGlobalErrorCode(query.meta, error)
      if (code) showErrorToast(code)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return
      const code = resolveGlobalErrorCode(mutation.meta, error)
      if (code) showErrorToast(code)
    },
  }),
```

- [ ] **Step 6: Verify typecheck + lint + full test**

Run: `npm run typecheck && npx eslint lib/query-client.ts lib/global-error-gate.ts && npx jest __tests__/lib/global-error-gate.test.ts`
Expected: typecheck clean, no lint errors, tests PASS.

---

### Task 2: Blanket-skip the invisible menu prefetches

**Files:**
- Modify: `hooks/use-predictive-prefetch.ts` (6 `prefetchQuery` calls for specific-menu)
- Modify: `app/(tabs)/_layout.tsx:204-211` (1 `prefetchQuery` for specific-menu)

**Interfaces:**
- Consumes: the `skipGlobalError` meta key honored by `resolveGlobalErrorCode` (Task 1).

- [ ] **Step 1: Add meta to the Home-focus prefetch block in use-predictive-prefetch.ts**

Find the `if (hasBranch)` block inside `if (isOnHome)` and add `meta` to both branches:

```ts
        if (hasBranch) {
          if (hasUser) {
            queryClient.prefetchQuery({
              queryKey: ['specific-menu', menuRequest],
              queryFn: () => getSpecificMenu(menuRequest),
              meta: { skipGlobalError: true },
            })
          } else {
            queryClient.prefetchQuery({
              queryKey: ['public-specific-menu', menuRequest],
              queryFn: () => getPublicSpecificMenu(menuRequest),
              meta: { skipGlobalError: true },
            })
          }
        }
```

- [ ] **Step 2: Add meta to the menu-path prefetch block in use-predictive-prefetch.ts**

Find the `if (pathname?.startsWith('/menu') || pathname?.includes('/(tabs)/menu'))` block and add `meta` to both branches:

```ts
        if (hasBranch) {
          if (hasUser) {
            queryClient.prefetchQuery({
              queryKey: ['specific-menu', menuRequest],
              queryFn: () => getSpecificMenu(menuRequest),
              meta: { skipGlobalError: true },
            })
          } else {
            queryClient.prefetchQuery({
              queryKey: ['public-specific-menu', menuRequest],
              queryFn: () => getPublicSpecificMenu(menuRequest),
              meta: { skipGlobalError: true },
            })
          }
        }
```

- [ ] **Step 3: Add meta to the Home-idle prefetch block in use-predictive-prefetch.ts**

Find the block inside the `setTimeout(... HOME_IDLE_PREFETCH_MS)` effect and add `meta` to both branches:

```ts
        if (hasUser) {
          queryClient.prefetchQuery({
            queryKey: ['specific-menu', menuRequest],
            queryFn: () => getSpecificMenu(menuRequest),
            meta: { skipGlobalError: true },
          })
        } else {
          queryClient.prefetchQuery({
            queryKey: ['public-specific-menu', menuRequest],
            queryFn: () => getPublicSpecificMenu(menuRequest),
            meta: { skipGlobalError: true },
          })
        }
```

- [ ] **Step 4: Add meta to the tab-press prefetch in app/(tabs)/_layout.tsx**

Replace the `prefetchQuery` block (around lines 204-211):

```ts
          if (!queryClient.getQueryData(cacheKey)) {
            queryClient
              .prefetchQuery({
                queryKey: cacheKey,
                queryFn: () =>
                  hasUser
                    ? getSpecificMenu(menuRequest)
                    : getPublicSpecificMenu(menuRequest),
                meta: { skipGlobalError: true },
              })
              .catch(() => {})
          }
```

- [ ] **Step 5: Verify typecheck + lint**

Run: `npm run typecheck && npx eslint hooks/use-predictive-prefetch.ts "app/(tabs)/_layout.tsx"`
Expected: typecheck clean, no lint errors.

---

### Task 3: Targeted-skip the reusable visible menu hooks

**Files:**
- Modify: `hooks/use-menu.ts:9-31` (`useSpecificMenu`, `usePublicSpecificMenu`)

**Interfaces:**
- Consumes: the `skipGlobalErrorCodes` meta key honored by `resolveGlobalErrorCode` (Task 1).

- [ ] **Step 1: Add meta to useSpecificMenu**

```ts
export const useSpecificMenu = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: ['specific-menu', query],
    queryFn: async () => getSpecificMenu(query),
    enabled: !!enabled,
    staleTime: 30_000,
    meta: { skipGlobalErrorCodes: [401, 403] },
  })
}
```

- [ ] **Step 2: Add meta to usePublicSpecificMenu**

```ts
export const usePublicSpecificMenu = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: ['public-specific-menu', query],
    queryFn: async () => getPublicSpecificMenu(query),
    enabled: !!enabled,
    staleTime: 30_000,
    meta: { skipGlobalErrorCodes: [401, 403] },
  })
}
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `npm run typecheck && npx eslint hooks/use-menu.ts`
Expected: typecheck clean, no lint errors.

---

### Task 4: Siết — targeted-skip the Menu tab screen queries

**Files:**
- Modify: `app/(tabs)/menu/index.tsx:298-323` (private + public `useQuery` meta)

**Interfaces:**
- Consumes: the `skipGlobalErrorCodes` meta key honored by `resolveGlobalErrorCode` (Task 1).

- [ ] **Step 1: Change the private query meta**

In the `useQuery` for `queryKey: ['specific-menu', request]`, replace:

```ts
    meta: { skipGlobalError: true },
```

with:

```ts
    meta: { skipGlobalErrorCodes: [401, 403] },
```

- [ ] **Step 2: Change the public query meta**

In the `useQuery` for `queryKey: ['public-specific-menu', request]`, replace:

```ts
    meta: { skipGlobalError: true },
```

with:

```ts
    meta: { skipGlobalErrorCodes: [401, 403] },
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `npm run typecheck && npx eslint "app/(tabs)/menu/index.tsx"`
Expected: typecheck clean, no lint errors.

---

### Task 5: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the whole quality gate**

Run: `npm run typecheck && npm run lint && npx jest __tests__/lib/global-error-gate.test.ts`
Expected: all pass.

- [ ] **Step 2: Confirm no stray `skipGlobalError: true` remains on the four menu callers we retargeted**

Run: `grep -rn "skipGlobalError" hooks/use-menu.ts "app/(tabs)/menu/index.tsx"`
Expected: only `skipGlobalErrorCodes: [401, 403]` lines (no bare `skipGlobalError: true`). Prefetches (`use-predictive-prefetch.ts`, `_layout.tsx`) intentionally keep bare `skipGlobalError: true`.

- [ ] **Step 3: Manual behavior check (optional, needs a device/simulator)**

With an intentionally-invalidated session token, enter the Menu tab.
Expected: menu renders all items via the public fallback, and NO "Không có quyền truy cập, vui lòng đăng nhập lại" toast appears. A forced 500 on the menu endpoint DOES show an error toast.

---

## Expected UX after this plan

| Case | Toast? | User sees |
|---|---|---|
| Guest / valid login, network OK | none | Full menu |
| Logged in but token revoked (the bug) | **none** (was false "log in again") | Full menu via public fallback; login prompted only at add-to-cart / checkout |
| Real 500 on menu | **toast** (was silent on the tab screen) | Empty/skeleton + error toast |
| Offline / network error (no HTTP code) | none (unchanged) | Cached or empty — separate follow-up (NetInfo), out of scope |

## Notes / out of scope

- Case 5 (offline with no cache showing a blank screen) is a separate, app-wide concern (NetInfo + onlineManager + banner). Not in this plan.
- `useSpecificMenuItem` (product-detail endpoint) is a different flow and is intentionally untouched.
