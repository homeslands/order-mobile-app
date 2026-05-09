# Gift Card Dark Mode & Filter Sync — Round 4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dark mode status badge colors in two gift card screens, add semantic status colors to GiftCardFilterSheet chips with immediate parent sync, and add type filter chips to DateFilterSheet in the order history screen.

**Architecture:** Three independent inline changes across four files. No new components, no new state shapes. Colors follow the canonical dark palette: `'#14532d'`/`'#86efac'` (green), `'#713f12'`/`'#fde68a'` (amber), `'#7f1d1d'`/`'#fca5a5'` (red). Static `PAYMENT_STATUS_COLORS` constant is replaced with a `getPaymentStatusColors(isDark)` function so dark variants are accessible at render time.

**Tech Stack:** React Native, NativeWind, `useColorScheme`, `@/constants/colors`, `@gorhom/bottom-sheet`

---

## Files

| File                                                    | Change                                                                                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/profile/gift-card-orders.tsx`                      | StatusBadge dark mode; DateFilterSheet: add type chips + `selectedType`/`onTypeChange` props, expand snapPoints to `'65%'`; main screen: pass `selectedType`/`handleTypeSelect` to DateFilterSheet |
| `components/gift-card/gift-card-order-detail-sheet.tsx` | `PAYMENT_STATUS_COLORS` → `getPaymentStatusColors(isDark)` function; update `statusCfg` useMemo                                                                                                    |
| `app/profile/gift-cards.tsx`                            | `StatusPill` AVAILABLE + EXPIRED dark mode                                                                                                                                                         |
| `components/gift-card/gift-card-filter-sheet.tsx`       | Status chips use semantic colors (like StatusPill) + add `onStatusChange` prop for immediate parent sync                                                                                           |

---

### Task A: Fix StatusBadge dark mode + PAYMENT_STATUS_COLORS

**Files:**

- Modify: `app/profile/gift-card-orders.tsx`
- Modify: `components/gift-card/gift-card-order-detail-sheet.tsx`

**Context:** `StatusBadge` in gift-card-orders.tsx and `PAYMENT_STATUS_COLORS` in gift-card-order-detail-sheet.tsx both use hardcoded light-mode pastel colors with no dark variants. Both components already have `isDark` available.

- [ ] **Step 1: Fix StatusBadge dark mode**

In `app/profile/gift-card-orders.tsx`, replace the `StatusBadge` function body (lines ~126-151):

```tsx
function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const { t } = useTranslation('giftCard')
  const upper = (status ?? '').toUpperCase()
  let bg = isDark ? colors.border.dark : colors.gray[200]
  let color = isDark ? colors.gray[400] : colors.gray[500]
  let label = status ?? ''

  if (upper === 'COMPLETED' || upper === 'PAID') {
    bg = isDark ? '#14532d' : '#dcfce7'
    color = isDark ? '#86efac' : '#16a34a'
    label = t('orderStatus.completedShort')
  } else if (upper === 'PENDING') {
    bg = isDark ? '#713f12' : '#fef9c3'
    color = isDark ? '#fde68a' : '#b45309'
    label = t('orderStatus.pendingShort')
  } else if (upper === 'CANCELLED') {
    bg = isDark ? '#7f1d1d' : '#fee2e2'
    color = isDark ? '#fca5a5' : '#dc2626'
    label = t('orderStatus.cancelled')
  }

  return (
    <View style={[sb.wrap, { backgroundColor: bg }]}>
      <Text style={[sb.text, { color }]}>{label}</Text>
    </View>
  )
}
```

- [ ] **Step 2: Convert PAYMENT_STATUS_COLORS to a function**

In `components/gift-card/gift-card-order-detail-sheet.tsx`, replace:

```ts
const PAYMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: '#dcfce7', text: '#16a34a' },
  PAID: { bg: '#dcfce7', text: '#16a34a' },
  PENDING: { bg: '#fef9c3', text: '#b45309' },
  FAILED: { bg: '#fee2e2', text: '#dc2626' },
  CANCELLED: { bg: '#fee2e2', text: '#dc2626' },
}
```

With:

```ts
function getPaymentStatusColors(
  isDark: boolean,
): Record<string, { bg: string; text: string }> {
  return {
    COMPLETED: {
      bg: isDark ? '#14532d' : '#dcfce7',
      text: isDark ? '#86efac' : '#16a34a',
    },
    PAID: {
      bg: isDark ? '#14532d' : '#dcfce7',
      text: isDark ? '#86efac' : '#16a34a',
    },
    PENDING: {
      bg: isDark ? '#713f12' : '#fef9c3',
      text: isDark ? '#fde68a' : '#b45309',
    },
    FAILED: {
      bg: isDark ? '#7f1d1d' : '#fee2e2',
      text: isDark ? '#fca5a5' : '#dc2626',
    },
    CANCELLED: {
      bg: isDark ? '#7f1d1d' : '#fee2e2',
      text: isDark ? '#fca5a5' : '#dc2626',
    },
  }
}
```

- [ ] **Step 3: Update statusCfg useMemo to use the new function**

In `components/gift-card/gift-card-order-detail-sheet.tsx`, the `statusCfg` useMemo (around line 192) shadows the imported `colors` with a local variable named `colors`. Fix the variable name AND call the new function:

Replace:

```ts
const statusCfg = useMemo(() => {
  if (!order) return null
  const key = (order.paymentStatus ?? '').toUpperCase()
  const colors = PAYMENT_STATUS_COLORS[key]
  return colors
    ? {
        ...colors,
        label:
          paymentStatusLabelMap[key as keyof typeof paymentStatusLabelMap] ??
          order.paymentStatus,
      }
    : { bg: cardBg, text: subColor, label: order.paymentStatus }
}, [order, paymentStatusLabelMap, cardBg, subColor])
```

With:

```ts
const statusCfg = useMemo(() => {
  if (!order) return null
  const key = (order.paymentStatus ?? '').toUpperCase()
  const statusColors = getPaymentStatusColors(isDark)
  const cfg = statusColors[key]
  return cfg
    ? {
        ...cfg,
        label:
          paymentStatusLabelMap[key as keyof typeof paymentStatusLabelMap] ??
          order.paymentStatus,
      }
    : { bg: cardBg, text: subColor, label: order.paymentStatus }
}, [order, isDark, paymentStatusLabelMap, cardBg, subColor])
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/profile/gift-card-orders.tsx components/gift-card/gift-card-order-detail-sheet.tsx
git commit -m "fix(gift-card): dark mode status badge colors in order history and detail sheet"
```

---

### Task B: Fix StatusPill dark mode + GiftCardFilterSheet semantic colors + sync

**Files:**

- Modify: `app/profile/gift-cards.tsx`
- Modify: `components/gift-card/gift-card-filter-sheet.tsx`

**Context:** `StatusPill` in gift-cards.tsx has hardcoded light pastels for AVAILABLE and EXPIRED. `GiftCardFilterSheet` status chips use `primaryColor` for all active states — they should use the same semantic status colors as `StatusPill`. When a chip is selected in the sheet, `onStatusChange` should fire immediately (like `StatusQuickFilter`) so the main screen's filter reflects the choice right away.

- [ ] **Step 1: Fix StatusPill dark mode in gift-cards.tsx**

In `app/profile/gift-cards.tsx`, replace the `StatusPill` function body (around line 226-243):

```tsx
function StatusPill({ status, isDark }: { status: string; isDark: boolean }) {
  const { t } = useTranslation('giftCard')
  const config =
    status === GiftCardUsageStatus.AVAILABLE
      ? {
          bg: isDark ? '#14532d' : '#dcfce7',
          text: isDark ? '#86efac' : '#16a34a',
          label: t('status.available'),
        }
      : status === GiftCardUsageStatus.USED
        ? {
            bg: isDark ? colors.border.dark : colors.gray[200],
            text: isDark ? colors.gray[400] : colors.gray[500],
            label: t('status.used'),
          }
        : {
            bg: isDark ? '#7f1d1d' : '#fee2e2',
            text: isDark ? '#fca5a5' : '#dc2626',
            label: t('status.expired'),
          }

  return (
    <View style={[pill.wrap, { backgroundColor: config.bg }]}>
      <Text style={[pill.text, { color: config.text }]}>{config.label}</Text>
    </View>
  )
}
```

- [ ] **Step 2: Add onStatusChange prop to GiftCardFilterSheet Props interface**

In `components/gift-card/gift-card-filter-sheet.tsx`, update the `Props` interface:

```ts
interface Props {
  visible: boolean
  value: GiftCardFilter
  onClose: () => void
  onApply: (v: GiftCardFilter) => void
  onStatusChange?: (v: GiftCardUsageStatus | null) => void
  primaryColor: string
  isDark: boolean
}
```

And add `onStatusChange` to the destructured params:

```tsx
export const GiftCardFilterSheet = memo(function GiftCardFilterSheet({
  visible,
  value,
  onClose,
  onApply,
  onStatusChange,
  primaryColor,
  isDark,
}: Props) {
```

- [ ] **Step 3: Call onStatusChange immediately when a chip is selected**

In `components/gift-card/gift-card-filter-sheet.tsx`, replace the chip `onPress` in the STATUS_OPTIONS map:

Replace:

```tsx
onPress={() => setLocalStatus(opt.value)}
```

With:

```tsx
onPress={() => {
  setLocalStatus(opt.value)
  onStatusChange?.(opt.value)
}}
```

- [ ] **Step 4: Give active chips semantic status colors**

In the STATUS_OPTIONS chip rendering in `components/gift-card/gift-card-filter-sheet.tsx`, replace the chip `style` and text `color` so active chips use semantic colors instead of `primaryColor`:

Replace the entire chip block:

```tsx
<GHTouchable
  onPress={() => setLocalStatus(opt.value)}
  activeOpacity={0.7}
  style={[fs.chip, { backgroundColor: active ? primaryColor : chipBg }]}
>
  <Text
    style={[
      fs.chipText,
      {
        color: active
          ? colors.white.light
          : isDark
            ? colors.gray[300]
            : colors.gray[700],
        fontWeight: active ? '700' : '500',
      },
    ]}
  >
    {opt.label}
  </Text>
</GHTouchable>
```

With:

```tsx
<GHTouchable
  onPress={() => {
    setLocalStatus(opt.value)
    onStatusChange?.(opt.value)
  }}
  activeOpacity={0.7}
  style={[
    fs.chip,
    {
      backgroundColor: active ? getStatusChipBg(opt.value, isDark) : chipBg,
    },
  ]}
>
  <Text
    style={[
      fs.chipText,
      {
        color: active
          ? getStatusChipText(opt.value, isDark)
          : isDark
            ? colors.gray[300]
            : colors.gray[700],
        fontWeight: active ? '700' : '500',
      },
    ]}
  >
    {opt.label}
  </Text>
</GHTouchable>
```

And add these two helper functions ABOVE the `GiftCardFilterSheet` component definition (but below the constants):

```ts
function getStatusChipBg(
  status: GiftCardUsageStatus | null,
  isDark: boolean,
): string {
  if (status === GiftCardUsageStatus.AVAILABLE)
    return isDark ? '#14532d' : '#dcfce7'
  if (status === GiftCardUsageStatus.EXPIRED)
    return isDark ? '#7f1d1d' : '#fee2e2'
  if (status === GiftCardUsageStatus.USED)
    return isDark ? colors.border.dark : colors.gray[200]
  // null = ALL — use primary-tinted background via caller
  return isDark ? colors.border.dark : colors.gray[200]
}

function getStatusChipText(
  status: GiftCardUsageStatus | null,
  isDark: boolean,
): string {
  if (status === GiftCardUsageStatus.AVAILABLE)
    return isDark ? '#86efac' : '#16a34a'
  if (status === GiftCardUsageStatus.EXPIRED)
    return isDark ? '#fca5a5' : '#dc2626'
  if (status === GiftCardUsageStatus.USED)
    return isDark ? colors.gray[400] : colors.gray[500]
  // null = ALL — neutral muted
  return isDark ? colors.gray[300] : colors.gray[700]
}
```

Note: For `null` (ALL) chips, both functions return neutral/muted colors. These will look slightly off if we want ALL to stand out when active. To make ALL active look distinguished, we can alternatively use `primaryColor` for ALL only. Update the chip rendering to handle this:

```tsx
style={[
  fs.chip,
  {
    backgroundColor: active
      ? (opt.value === null
          ? primaryColor
          : getStatusChipBg(opt.value, isDark))
      : chipBg,
  },
]}
```

And for text:

```tsx
color: active
  ? (opt.value === null
      ? colors.white.light
      : getStatusChipText(opt.value, isDark))
  : isDark
    ? colors.gray[300]
    : colors.gray[700],
```

- [ ] **Step 5: Pass handleStatusFilter as onStatusChange in gift-cards.tsx**

In `app/profile/gift-cards.tsx`, update the `GiftCardFilterSheet` usage:

Replace:

```tsx
<GiftCardFilterSheet
  key={filterSheetOpen ? 'open' : 'closed'}
  visible={filterSheetOpen}
  value={filter}
  primaryColor={primaryColor}
  isDark={isDark}
  onClose={() => setFilterSheetOpen(false)}
  onApply={handleApplyFilter}
/>
```

With:

```tsx
<GiftCardFilterSheet
  key={filterSheetOpen ? 'open' : 'closed'}
  visible={filterSheetOpen}
  value={filter}
  primaryColor={primaryColor}
  isDark={isDark}
  onClose={() => setFilterSheetOpen(false)}
  onApply={handleApplyFilter}
  onStatusChange={handleStatusFilter}
/>
```

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/profile/gift-cards.tsx components/gift-card/gift-card-filter-sheet.tsx
git commit -m "fix(gift-card): status pill dark mode + filter sheet semantic chip colors + sync"
```

---

### Task C: Add type filter chips to DateFilterSheet in gift-card-orders.tsx

**Files:**

- Modify: `app/profile/gift-card-orders.tsx`

**Context:** `DateFilterSheet` (the filter sheet on the gift card order history screen) only has date range pickers. The main screen has type filter chips (ALL / ME / GIFT / BUY) via `FilterBar`. The user wants to see the same type chips inside the sheet with immediate sync — selecting a chip in the sheet immediately updates `selectedType` on the main screen (same as tapping a chip in the main `FilterBar`). `snapPoints` must grow from `'50%'` to `'65%'` to fit the new section.

Type chip values come from `GiftCardType`:

- `'ALL'` (string literal, not enum)
- `GiftCardType.SELF = 'SELF'`
- `GiftCardType.GIFT = 'GIFT'`
- `GiftCardType.BUY = 'BUY'`

Labels come from the existing `TYPE_FILTERS` array in the main screen.

- [ ] **Step 1: Find the DATE_SNAP constant and update snapPoints**

In `app/profile/gift-card-orders.tsx`, find the `DATE_SNAP` constant (near the `DateFilterSheet` component definition). Replace:

```ts
const DATE_SNAP = ['50%']
```

With:

```ts
const DATE_SNAP = ['65%']
```

If `DATE_SNAP` does not exist as a named constant and the snapPoints is inline in the JSX, replace the inline value:

```tsx
snapPoints={['50%']}
```

With:

```tsx
snapPoints = { DATE_SNAP }
```

And define:

```ts
const DATE_SNAP = ['65%']
```

above the `DateFilterSheet` component definition.

- [ ] **Step 2: Add selectedType + onTypeChange props to DateFilterSheet**

In `app/profile/gift-card-orders.tsx`, update the `DateFilterSheet` props interface:

Replace:

```tsx
}: {
  visible: boolean
  value: DateFilter
  primaryColor: string
  isDark: boolean
  onClose: () => void
  onApply: (v: DateFilter) => void
}
```

With:

```tsx
}: {
  visible: boolean
  value: DateFilter
  selectedType: string
  primaryColor: string
  isDark: boolean
  onClose: () => void
  onApply: (v: DateFilter) => void
  onTypeChange: (v: string) => void
}
```

And add `selectedType` and `onTypeChange` to the destructured params:

```tsx
const DateFilterSheet = memo(function DateFilterSheet({
  visible,
  value,
  selectedType,
  primaryColor,
  isDark,
  onClose,
  onApply,
  onTypeChange,
}: { ... }) {
```

- [ ] **Step 3: Define TYPE_FILTER_OPTIONS inside DateFilterSheet**

Add this constant INSIDE the `DateFilterSheet` function body (after the color derivations), using `useTranslation` which is already imported and used:

```tsx
const TYPE_FILTER_OPTIONS = useMemo(
  () => [
    { label: t('orders.types.all'), value: 'ALL' },
    { label: t('type.self'), value: GiftCardType.SELF },
    { label: t('type.gift'), value: GiftCardType.GIFT },
    { label: t('type.buy'), value: GiftCardType.BUY },
  ],
  [t],
)
```

Note: `GiftCardType` is already imported from `@/constants` in this file.

- [ ] **Step 4: Add type chip section to DateFilterSheet JSX**

In the `DateFilterSheet` return, after the title and BEFORE the date section (i.e., before `<Text style={[ds.sectionLabel ... ]}>{t('orders.dateRange')}</Text>`), insert:

```tsx
{/* Type */}
<Text style={[ds.sectionLabel, { color: subColor }]}>
  {t('orders.typeLabel')}
</Text>
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={ds.typeChipScroll}
>
  {TYPE_FILTER_OPTIONS.map((opt) => {
    const active = selectedType === opt.value
    return (
      <GHTouchable
        key={opt.value}
        onPress={() => onTypeChange(opt.value)}
        activeOpacity={0.7}
        style={[
          ds.typeChip,
          {
            backgroundColor: active ? primaryColor : chipBg,
          },
        ]}
      >
        <Text
          style={[
            ds.typeChipText,
            {
              color: active
                ? colors.white.light
                : isDark
                  ? colors.gray[300]
                  : colors.gray[700],
              fontWeight: active ? '700' : '500',
            },
          ]}
        >
          {opt.label}
        </Text>
      </GHTouchable>
    )
  })}
</ScrollView>
```

Note: `ScrollView` must be imported from `'react-native'` — it is already imported in this file.

- [ ] **Step 5: Add new StyleSheet entries for type chips**

In the `ds = StyleSheet.create({...})` at the bottom of the file (for `DateFilterSheet`), add:

```ts
typeChipScroll: { flexDirection: 'row', gap: 8, paddingBottom: 14 },
typeChip: {
  paddingHorizontal: 14,
  paddingVertical: 7,
  borderRadius: 999,
},
typeChipText: { fontSize: 13 },
```

- [ ] **Step 6: Also update handleReset to reset type**

In the `DateFilterSheet` function, update `handleReset`:

Replace:

```ts
const handleReset = useCallback(() => {
  onApply({ fromDate: null, toDate: null })
  sheetRef.current?.dismiss()
}, [onApply])
```

With:

```ts
const handleReset = useCallback(() => {
  onApply({ fromDate: null, toDate: null })
  onTypeChange('ALL')
  sheetRef.current?.dismiss()
}, [onApply, onTypeChange])
```

- [ ] **Step 7: Pass selectedType and handleTypeSelect to DateFilterSheet in the main screen**

In `GiftCardOrdersScreen` (bottom of the file), update the `DateFilterSheet` usage:

Replace:

```tsx
<DateFilterSheet
  visible={filterSheetOpen}
  value={dateFilter}
  primaryColor={primaryColor}
  isDark={isDark}
  onClose={handleFilterClose}
  onApply={handleFilterApply}
/>
```

With:

```tsx
<DateFilterSheet
  visible={filterSheetOpen}
  value={dateFilter}
  selectedType={selectedType}
  primaryColor={primaryColor}
  isDark={isDark}
  onClose={handleFilterClose}
  onApply={handleFilterApply}
  onTypeChange={handleTypeSelect}
/>
```

- [ ] **Step 8: Add i18n key orders.typeLabel if missing**

Check if `t('orders.typeLabel')` key exists in the giftCard translation file. If not, use `t('orders.filterTitle')` (already exists) as the section header, or just use the same text as the FilterBar label. To avoid adding new translation keys, replace `t('orders.typeLabel')` with the same approach as the date section uses `t('orders.dateRange')`. Use whichever existing key fits. If neither fits, fall back to hardcoded label or re-use `t('filter.statusLabel')` which is `"Loại"` or similar.

**Practical fallback**: replace `t('orders.typeLabel')` with `t('filter.typeLabel')` or check the existing translation namespace to find the right key. If not found, add a fallback string in English: `'Type'`. To check:

```bash
grep -rn "typeLabel\|orders\.type" /Users/phanquyetthang/mobile-movie-app/i18n/ | head -20
```

- [ ] **Step 9: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add app/profile/gift-card-orders.tsx
git commit -m "fix(gift-card): add type filter chips to date filter sheet with immediate sync"
```
