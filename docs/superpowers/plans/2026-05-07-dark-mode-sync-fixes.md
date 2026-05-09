# Dark Mode Color Sync Fixes — Round 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct remaining dark mode background/border color issues in the gift card payment screen, gift card checkout form, and revert the wrong status-filter row added to the gift card order history screen.

**Architecture:** All changes are inline color substitutions — replace `colors.gray[700/800/900]` dark-mode values with the canonical dark palette (`colors.card.dark = '#1c1c1e'`, `colors.background.dark = '#121212'`, `colors.border.dark = '#2e2e2e'`). Static `StyleSheet.create()` values that need dark mode are converted to dynamic via `useColorScheme()` inside the component.

**Tech Stack:** React Native, NativeWind, `useColorScheme`, `@/constants/colors`

---

## Files

| File                                | Change                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `app/profile/gift-card-orders.tsx`  | Remove `StatusFilterBar` component + all wiring; keep `StatusBadge` null guard |
| `app/gift-card/checkout/[slug].tsx` | Fix `cardBg`, `borderColor`, secondary button bg, `PaymentSkeleton` dark mode  |
| `app/gift-card/checkout/index.tsx`  | Fix total row `borderTopColor`                                                 |

---

### Task 1: Revert StatusFilterBar in gift-card-orders.tsx

**Files:**

- Modify: `app/profile/gift-card-orders.tsx`

**Context:** A wrong `StatusFilterBar` component (PAID/PENDING/CANCELLED chips) was added. The user wants it removed — the existing type chips (for-me/gift/bulk-buy) are sufficient. Only the `StatusBadge` null guard (`label = status ?? ''`) must stay.

- [ ] **Step 1: Remove the StatusFilterBar component and its stylesheet**

In `app/profile/gift-card-orders.tsx`, delete the entire block from `// ─── Status filter bar ───` through the closing `const sfb = StyleSheet.create({...})`. That is this entire chunk (lines ~124-228):

```
// ─── Status filter bar ───────────────────────────────────────────────────────

const StatusFilterBar = memo(function StatusFilterBar({ ... }) {
  ...
})

const sfb = StyleSheet.create({
  scroll: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  chip: { ... },
  chipText: { fontSize: 12, fontWeight: '600' },
})
```

- [ ] **Step 2: Remove `selectedStatus` state**

Delete this line (in `GiftCardOrdersScreen`):

```ts
const [selectedStatus, setSelectedStatus] = useState('ALL')
```

- [ ] **Step 3: Revert the items useMemo back to type-only filter**

Replace:

```ts
const items = useMemo(() => {
  let result =
    selectedType === 'ALL'
      ? allItems
      : allItems.filter((o) => (o.type ?? '').toUpperCase() === selectedType)
  if (selectedStatus !== 'ALL') {
    result = result.filter(
      (o) => (o.paymentStatus ?? '').toUpperCase() === selectedStatus,
    )
  }
  return result
}, [allItems, selectedType, selectedStatus])
```

With:

```ts
const items = useMemo(
  () =>
    selectedType === 'ALL'
      ? allItems
      : allItems.filter((o) => (o.type ?? '').toUpperCase() === selectedType),
  [allItems, selectedType],
)
```

- [ ] **Step 4: Remove the selectedStatus scroll reset effect**

Delete:

```ts
useEffect(() => {
  flashListRef.current?.scrollToOffset({ offset: 0, animated: false })
}, [selectedStatus])
```

- [ ] **Step 5: Remove handleStatusSelect callback**

Delete:

```ts
const handleStatusSelect = useCallback((v: string) => setSelectedStatus(v), [])
```

- [ ] **Step 6: Remove StatusFilterBar from render**

Delete this block from the JSX (inside `filterBarFixed`):

```tsx
<StatusFilterBar
  selected={selectedStatus}
  primaryColor={primaryColor}
  isDark={isDark}
  onSelect={handleStatusSelect}
/>
```

- [ ] **Step 7: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/profile/gift-card-orders.tsx
git commit -m "fix(gift-card): revert wrong status filter bar in order history"
```

---

### Task 2: Fix dark mode in gift card payment screen

**Files:**

- Modify: `app/gift-card/checkout/[slug].tsx`

**Context:** This screen (`màn thanh toán đơn mua gift card`) has four dark mode issues:

1. `PaymentSkeleton` uses static `colors.white.light` and `colors.gray[100]` — no dark variant
2. `QRSection` container border uses `colors.gray[700]`
3. Main screen `cardBg` uses `colors.gray[900]` (should be `colors.card.dark`)
4. Main screen `borderColor` uses `colors.gray[700]` (should be `colors.border.dark`)
5. Success screen secondary button bg uses `colors.gray[700]` (should be `colors.border.dark`)

- [ ] **Step 1: Add dark mode to PaymentSkeleton**

`PaymentSkeleton` is a zero-prop component. Add `useColorScheme` inside it and pass dynamic styles.

Replace:

```tsx
function PaymentSkeleton() {
  return (
    <View style={sk.wrapper}>
      <View style={sk.card}>
        <Skeleton style={sk.line} />
        <Skeleton style={[sk.line, { width: '60%' }]} />
        <Skeleton style={[sk.line, { width: '40%' }]} />
      </View>
      <View style={sk.card}>
        <Skeleton style={[sk.line, { width: '50%' }]} />
        <Skeleton style={{ height: 200, borderRadius: 12 }} />
      </View>
    </View>
  )
}

const sk = StyleSheet.create({
  wrapper: { padding: 16, gap: 12, marginTop: 8 },
  card: {
    backgroundColor: colors.white.light,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  line: { height: 16, borderRadius: 6 },
})
```

With:

```tsx
function PaymentSkeleton() {
  const isDark = useColorScheme() === 'dark'
  const cardOverride = {
    backgroundColor: isDark ? colors.card.dark : colors.white.light,
    borderColor: isDark ? colors.border.dark : colors.gray[100],
  }
  return (
    <View style={sk.wrapper}>
      <View style={[sk.card, cardOverride]}>
        <Skeleton style={sk.line} />
        <Skeleton style={[sk.line, { width: '60%' }]} />
        <Skeleton style={[sk.line, { width: '40%' }]} />
      </View>
      <View style={[sk.card, cardOverride]}>
        <Skeleton style={[sk.line, { width: '50%' }]} />
        <Skeleton style={{ height: 200, borderRadius: 12 }} />
      </View>
    </View>
  )
}

const sk = StyleSheet.create({
  wrapper: { padding: 16, gap: 12, marginTop: 8 },
  card: {
    backgroundColor: colors.white.light,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  line: { height: 16, borderRadius: 6 },
})
```

- [ ] **Step 2: Fix QRSection container border**

In `QRSection`'s `return`, replace:

```tsx
{ borderColor: isDark ? colors.gray[700] : colors.gray[200] },
```

With:

```tsx
{ borderColor: isDark ? colors.border.dark : colors.gray[200] },
```

- [ ] **Step 3: Fix cardBg and borderColor in main screen**

In `GiftCardPaymentScreen`, the Colors section:

Replace:

```ts
const cardBg = isDark ? colors.gray[900] : colors.white.light
const borderColor = isDark ? colors.gray[700] : colors.gray[200]
```

With:

```ts
const cardBg = isDark ? colors.card.dark : colors.white.light
const borderColor = isDark ? colors.border.dark : colors.gray[200]
```

- [ ] **Step 4: Fix success screen secondary button**

In `GiftCardPaymentSuccessScreen`'s `onViewDetail` pressable, replace:

```tsx
backgroundColor: isDark ? colors.gray[700] : colors.gray[100],
```

With:

```tsx
backgroundColor: isDark ? colors.border.dark : colors.gray[100],
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/gift-card/checkout/[slug].tsx
git commit -m "fix(gift-card): sync dark mode colors in payment screen"
```

---

### Task 3: Fix remaining border in gift card checkout form

**Files:**

- Modify: `app/gift-card/checkout/index.tsx`

**Context:** The confirmation bottom sheet's total row divider uses `colors.gray[700]` in dark mode. One line to fix.

- [ ] **Step 1: Fix totalRow borderTopColor**

In `app/gift-card/checkout/index.tsx`, find the total row final divider (around line 710):

Replace:

```tsx
borderTopColor: isDark
  ? colors.gray[700]
  : colors.border.light,
```

With:

```tsx
borderTopColor: isDark
  ? colors.border.dark
  : colors.border.light,
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/gift-card/checkout/index.tsx
git commit -m "fix(gift-card): fix dark mode border in checkout confirm sheet"
```
