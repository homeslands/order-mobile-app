# Gift Card Menu Flow Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the gift card purchase screen's data-fetching flow with the menu screen's proven pattern, and add proper error state UI with retry.

**Architecture:** Two focused changes: (1) `hooks/use-gift-cards.ts` gets `meta: { skipGlobalError: true }`, `refetchOnMount: false`, and a higher `staleTime` so the screen handles errors locally without double-toasting; (2) `app/(tabs)/gift-card.tsx` adopts menu's `useFocusEffect` reset pattern, fixes the skeleton condition to use `isPending` only (so cached data shows immediately on tab return), and adds a proper error state block with a retry button.

**Tech Stack:** React Native, Expo Router, TanStack React Query v5, Zustand, TypeScript strict

---

## File Map

| File                       | Change                                                                    |
| -------------------------- | ------------------------------------------------------------------------- |
| `hooks/use-gift-cards.ts`  | Add `meta`, `refetchOnMount: false`, raise `staleTime` to 5 min           |
| `app/(tabs)/gift-card.tsx` | Reset `allowFetch` on blur, fix skeleton condition, add error UI + styles |

---

### Task 1: Update `useGiftCards` hook options

**Files:**

- Modify: `hooks/use-gift-cards.ts:19-36`

Context: `useGiftCards` is used only in `app/(tabs)/gift-card.tsx`. The global `QueryCache.onError` in `app/_layout.tsx` (line 115) skips toast when `query.meta?.skipGlobalError` is true — we need this so the screen can show its own error UI without a global toast also firing. `refetchOnMount: false` matches the menu screen pattern (the `allowFetch` gate drives refetching, not mount lifecycle). `staleTime: 5 * 60_000` is safe because gift card catalogue changes infrequently.

- [ ] **Step 1: Update the hook**

Replace the `useGiftCards` function in `hooks/use-gift-cards.ts` with:

```typescript
export const useGiftCards = (
  params?: IGetGiftCardsRequest,
  options?: { enabled?: boolean },
) => {
  return useQuery<
    IApiResponse<IPaginationResponse<IGiftCard>>,
    Error,
    IPaginationResponse<IGiftCard>
  >({
    queryKey: [QUERYKEY.giftCards, params],
    queryFn: () => getGiftCards(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    meta: { skipGlobalError: true },
    enabled: options?.enabled !== false,
  })
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: exit 0, no errors in `hooks/use-gift-cards.ts`.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-gift-cards.ts
git commit -m "perf(gift-card): skipGlobalError, refetchOnMount=false, staleTime 5min"
```

---

### Task 2: Align `useFocusEffect` reset pattern in gift card screen

**Files:**

- Modify: `app/(tabs)/gift-card.tsx:156-170` (the `useFocusEffect` block)

Context: Menu screen resets `allowFetch` to `false` at the start of each focus AND in the cleanup function. This disables the query during tab transitions (preventing stale fetches mid-animation) and re-enables it after the `InteractionManager + 120ms` delay. Gift card screen currently never resets — `allowFetch` stays `true` forever after first focus. The fix is a one-line addition in two places.

Current code (lines 157–170):

```typescript
useFocusEffect(
  useCallback(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        startTransition(() => setAllowFetch(true))
      }, ENTRY_FETCH_DELAY_MS)
    })
    return () => {
      task.cancel()
      if (timer) clearTimeout(timer)
    }
  }, []),
)
```

- [ ] **Step 1: Add reset on focus entry and cleanup**

Replace the `useFocusEffect` block with:

```typescript
useFocusEffect(
  useCallback(() => {
    setAllowFetch(false)
    let timer: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        startTransition(() => setAllowFetch(true))
      }, ENTRY_FETCH_DELAY_MS)
    })
    return () => {
      task.cancel()
      if (timer) clearTimeout(timer)
      setAllowFetch(false)
    }
  }, []),
)
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/gift-card.tsx
git commit -m "fix(gift-card): reset allowFetch on focus/blur, match menu screen pattern"
```

---

### Task 3: Fix skeleton condition + add error state with retry

**Files:**

- Modify: `app/(tabs)/gift-card.tsx` — destructuring at line 172, render at lines 404–430, StyleSheet at line 457+

Context: Current condition `!allowFetch || isPending` shows skeleton whenever `allowFetch` is false — with the new reset pattern that means skeleton flashes on every tab return even when cached data exists. Fix: use `isPending` alone. `isPending` (React Query v5) is `true` only when there is no cached data — so returning to the tab with fresh cache keeps the list visible through the 120ms delay. Additionally, `isError` from the hook is currently ignored; when the API fails, users see the empty state "Chưa có thẻ quà tặng nào" which is misleading. Add an error branch with a retry button.

Current destructuring (line 172):

```typescript
const { data, isPending, refetch, isRefetching } = useGiftCards(undefined, {
  enabled: allowFetch,
})
```

- [ ] **Step 1: Add `isError` to destructuring**

```typescript
const { data, isPending, isError, refetch, isRefetching } = useGiftCards(
  undefined,
  { enabled: allowFetch },
)
```

- [ ] **Step 2: Replace the content render block (lines 403–430)**

Current:

```typescript
{/* Content */}
{!allowFetch || isPending ? (
  <GiftCardSkeleton />
) : items.length === 0 ? (
  <View style={s.empty}>
    <Gift size={48} color={colors.gray[300]} />
    <Text style={[s.emptyText, { color: subColor }]}>
      Chưa có thẻ quà tặng nào
    </Text>
  </View>
) : (
  <FlashList
```

Replace with:

```typescript
{/* Content */}
{isPending ? (
  <GiftCardSkeleton />
) : isError ? (
  <View style={s.empty}>
    <Gift size={48} color={colors.gray[300]} />
    <Text style={[s.emptyText, { color: subColor }]}>
      Không thể tải thẻ quà tặng
    </Text>
    <Pressable
      onPress={() => refetch()}
      style={[s.retryBtn, { backgroundColor: primaryColor }]}
    >
      <Text style={s.retryBtnText}>Thử lại</Text>
    </Pressable>
  </View>
) : items.length === 0 ? (
  <View style={s.empty}>
    <Gift size={48} color={colors.gray[300]} />
    <Text style={[s.emptyText, { color: subColor }]}>
      Chưa có thẻ quà tặng nào
    </Text>
  </View>
) : (
  <FlashList
```

- [ ] **Step 3: Add `retryBtn` and `retryBtnText` to the `StyleSheet.create` block**

Append inside the `const s = StyleSheet.create({` object (after the `emptyText` entry):

```typescript
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0. Check specifically that `isError` and `refetch` types are correct — `isError: boolean`, `refetch: () => Promise<QueryObserverResult>`.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/gift-card.tsx
git commit -m "fix(gift-card): fix skeleton condition, add error state with retry button"
```

---

### Task 4: Manual verification checklist

**Files:** none (manual testing step)

- [ ] **Step 1: Start dev server**

```bash
npx expo start
```

- [ ] **Step 2: Test golden path**
  - Open Gift Card tab → skeleton shows → list loads ✅
  - Leave tab, return → list appears immediately (no skeleton flash if data is fresh) ✅
  - Pull to refresh → spinner shows → list refreshes ✅

- [ ] **Step 3: Test error state**
  - Disconnect device from network, open Gift Card tab (clear cache first via dev menu if needed)
  - Should show: gift icon + "Không thể tải thẻ quà tặng" + "Thử lại" button ✅
  - Reconnect, tap "Thử lại" → list loads ✅
  - No global error toast should fire (global handler skipped via `skipGlobalError`) ✅

- [ ] **Step 4: Test empty state**
  - If server has no gift cards: shows "Chưa có thẻ quà tặng nào" ✅
  - Not confused with error state ✅

- [ ] **Step 5: Final commit message confirmation**

All three prior commits should be visible in `git log`:

```
fix(gift-card): fix skeleton condition, add error state with retry button
fix(gift-card): reset allowFetch on focus/blur, match menu screen pattern
perf(gift-card): skipGlobalError, refetchOnMount=false, staleTime 5min
```
