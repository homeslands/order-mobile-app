# Sort & Date Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sort toggle (Mới nhất/Cũ nhất) to the Gift Card Orders filter sheet, and add a date range filter button + bottom sheet to the Food Order History screen.

**Architecture:** Both features live entirely in existing single-file screens (`app/profile/gift-card-orders.tsx` and `app/profile/history.tsx`). No new files are created. i18n keys are added to the four relevant locale JSON files first. Feature 1 extends the existing `DateFilterSheet` component with two new props (`selectedSort`, `onSortChange`). Feature 2 adds a new inline `HistoryDateFilterSheet` memo component and wires it into the existing `OrderHistoryPage` component.

**Tech Stack:** React Native (StyleSheet), `@gorhom/bottom-sheet` (BottomSheetModal), `react-native-date-picker`, `dayjs`, `react-native-gesture-handler` (GHTouchable for date pickers), `react-native` Pressable (for chips/buttons), lucide-react-native icons, i18next (vi/en JSON).

---

## File Map

| File                               | Change                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `i18n/vi/gift-card.json`           | Add `orders.sortLabel`, `orders.sortNewest`, `orders.sortOldest`                                  |
| `i18n/en/gift-card.json`           | Same in English                                                                                   |
| `i18n/vi/menu.json`                | Add `order.filterTitle`, `order.dateRange`, `order.fromDate`, `order.toDate`, `order.filterApply` |
| `i18n/en/menu.json`                | Same in English                                                                                   |
| `app/profile/gift-card-orders.tsx` | Feature 1: sort chips in `DateFilterSheet` + `sortDir` state in screen                            |
| `app/profile/history.tsx`          | Feature 2: `HistoryDateFilterSheet` + filter button + date chips                                  |

---

## Task 1: i18n — Add translation keys

**Files:**

- Modify: `i18n/vi/gift-card.json`
- Modify: `i18n/en/gift-card.json`
- Modify: `i18n/vi/menu.json`
- Modify: `i18n/en/menu.json`

- [ ] **Step 1: Add sort keys to `i18n/vi/gift-card.json`**

The `"orders"` object currently ends with `"empty": { ... }`. Add three new keys after `"apply"`:

```json
"sortLabel": "Sắp xếp",
"sortNewest": "Mới nhất",
"sortOldest": "Cũ nhất"
```

Full `orders` object after edit:

```json
"orders": {
  "title": "Lịch sử mua thẻ",
  "countOrders": "{{count}} đơn",
  "cards": "{{count}} thẻ",
  "types": {
    "all": "Tất cả"
  },
  "typeLabel": "Loại",
  "filterTitle": "Bộ lọc",
  "dateRange": "Khoảng thời gian",
  "fromDate": "Từ ngày",
  "toDate": "Đến ngày",
  "apply": "Áp dụng",
  "sortLabel": "Sắp xếp",
  "sortNewest": "Mới nhất",
  "sortOldest": "Cũ nhất",
  "empty": {
    "noOrders": "Chưa có đơn nào",
    "noOwned": "Bạn chưa mua thẻ quà tặng nào",
    "noType": "Không có đơn loại \"{{type}}\""
  }
}
```

- [ ] **Step 2: Add sort keys to `i18n/en/gift-card.json`**

Same location in the English file:

```json
"sortLabel": "Sort",
"sortNewest": "Newest",
"sortOldest": "Oldest"
```

Full `orders` object after edit:

```json
"orders": {
  "title": "Purchase History",
  "countOrders": "{{count}} orders",
  "cards": "{{count}} cards",
  "types": {
    "all": "All"
  },
  "typeLabel": "Type",
  "filterTitle": "Filter",
  "dateRange": "Date Range",
  "fromDate": "From Date",
  "toDate": "To Date",
  "apply": "Apply",
  "sortLabel": "Sort",
  "sortNewest": "Newest",
  "sortOldest": "Oldest",
  "empty": {
    "noOrders": "No orders yet",
    "noOwned": "You haven't purchased any gift cards",
    "noType": "No orders of type \"{{type}}\""
  }
}
```

- [ ] **Step 3: Add filter keys to `i18n/vi/menu.json`**

Find the `"order"` object. Add these five keys anywhere inside (e.g., after `"history": "Lịch sử đơn hàng"`):

```json
"filterTitle": "Bộ lọc",
"dateRange": "Khoảng thời gian",
"fromDate": "Từ ngày",
"toDate": "Đến ngày",
"filterApply": "Áp dụng"
```

- [ ] **Step 4: Add filter keys to `i18n/en/menu.json`**

Same inside the `"order"` object:

```json
"filterTitle": "Filter",
"dateRange": "Date Range",
"fromDate": "From Date",
"toDate": "To Date",
"filterApply": "Apply"
```

- [ ] **Step 5: Run typecheck + lint**

```bash
npm run check
```

Expected: exits 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add i18n/vi/gift-card.json i18n/en/gift-card.json i18n/vi/menu.json i18n/en/menu.json
git commit -m "feat(i18n): add sort and date filter translation keys"
```

---

## Task 2: Gift Card Orders — Sort Toggle in DateFilterSheet

**Files:**

- Modify: `app/profile/gift-card-orders.tsx`

Context: `DateFilterSheet` is a `memo` component defined inline in this file (lines ~280–619). `GiftCardOrdersScreen` is the default export at the bottom (lines ~623–1007).

- [ ] **Step 1: Expand `DateFilterSheet` snapPoints from `'65%'` to `'75%'`**

Find (around line 278):

```ts
const DATE_SNAP = ['65%']
```

Replace with:

```ts
const DATE_SNAP = ['75%']
```

- [ ] **Step 2: Add `selectedSort` and `onSortChange` to `DateFilterSheet` props interface**

Find (around line 280):

```ts
const DateFilterSheet = memo(function DateFilterSheet({
  visible,
  value,
  primaryColor,
  isDark,
  onClose,
  onApply,
  selectedType,
  onTypeChange,
}: {
  visible: boolean
  value: DateFilter
  primaryColor: string
  isDark: boolean
  onClose: () => void
  onApply: (v: DateFilter) => void
  selectedType: string
  onTypeChange: (v: string) => void
}) {
```

Replace with:

```ts
const DateFilterSheet = memo(function DateFilterSheet({
  visible,
  value,
  primaryColor,
  isDark,
  onClose,
  onApply,
  selectedType,
  onTypeChange,
  selectedSort,
  onSortChange,
}: {
  visible: boolean
  value: DateFilter
  primaryColor: string
  isDark: boolean
  onClose: () => void
  onApply: (v: DateFilter) => void
  selectedType: string
  onTypeChange: (v: string) => void
  selectedSort: string
  onSortChange: (v: string) => void
}) {
```

- [ ] **Step 3: Add `SORT_OPTIONS` useMemo inside `DateFilterSheet` body**

Add after the existing `TYPE_FILTER_OPTIONS` useMemo (around line 316):

```ts
const SORT_OPTIONS = useMemo(
  () => [
    { label: t('orders.sortNewest'), value: '-createdAt' },
    { label: t('orders.sortOldest'), value: '+createdAt' },
  ],
  [t],
)
```

- [ ] **Step 4: Update `handleReset` to also reset sort**

Find the existing `handleReset` (around line 346):

```ts
const handleReset = useCallback(() => {
  onApply({ fromDate: null, toDate: null })
  onTypeChange('ALL')
  sheetRef.current?.dismiss()
}, [onApply, onTypeChange])
```

Replace with:

```ts
const handleReset = useCallback(() => {
  onApply({ fromDate: null, toDate: null })
  onTypeChange('ALL')
  onSortChange('-createdAt')
  sheetRef.current?.dismiss()
}, [onApply, onTypeChange, onSortChange])
```

- [ ] **Step 5: Add sort chips section in the JSX between type chips and date range**

Find the JSX section label that precedes the date range (around line 418):

```tsx
<Text style={[ds.sectionLabel, { color: subColor }]}>
  {t('orders.dateRange')}
</Text>
```

Insert the sort section immediately before this label:

```tsx
          {/* Sort */}
          <Text style={[ds.sectionLabel, { color: subColor }]}>
            {t('orders.sortLabel')}
          </Text>
          <View style={ds.sortRow}>
            {SORT_OPTIONS.map((opt) => {
              const active = selectedSort === opt.value
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onSortChange(opt.value)}
                  style={[
                    ds.sortChip,
                    { backgroundColor: active ? primaryColor : chipBg },
                  ]}
                >
                  <Text
                    style={[
                      ds.sortChipText,
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
                </Pressable>
              )
            })}
          </View>

```

- [ ] **Step 6: Add sort styles to `ds` StyleSheet**

Find the `ds` StyleSheet at the bottom of the file (around line 574). Add two new style entries inside it after `typeChipText`:

```ts
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sortChip: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortChipText: { fontSize: 13 },
```

- [ ] **Step 7: Add `sortDir` state in `GiftCardOrdersScreen`**

Find the state declarations block near the start of `GiftCardOrdersScreen` (around line 650). After `const [filterSheetOpen, setFilterSheetOpen] = useState(false)`, add:

```ts
const [sortDir, setSortDir] = useState<'-createdAt' | '+createdAt'>(
  '-createdAt',
)
```

- [ ] **Step 8: Add `handleSortChange` callback**

Find the handlers block (around lines 716–723). After `handleFilterApply`, add:

```ts
const handleSortChange = useCallback(
  (v: '-createdAt' | '+createdAt') => setSortDir(v),
  [],
)
```

- [ ] **Step 9: Update `queryParams` to use `sortDir`**

Find the `queryParams` useMemo (around line 667):

```ts
const queryParams = useMemo(
  () => ({
    customerSlug: userSlug,
    sort: '-createdAt',
    ...(dateFilter.fromDate
      ? { fromDate: dayjs(dateFilter.fromDate).format('YYYY-MM-DD') }
      : {}),
    ...(dateFilter.toDate
      ? { toDate: dayjs(dateFilter.toDate).format('YYYY-MM-DD') }
      : {}),
  }),
  [userSlug, dateFilter],
)
```

Replace with:

```ts
const queryParams = useMemo(
  () => ({
    customerSlug: userSlug,
    sort: sortDir,
    ...(dateFilter.fromDate
      ? { fromDate: dayjs(dateFilter.fromDate).format('YYYY-MM-DD') }
      : {}),
    ...(dateFilter.toDate
      ? { toDate: dayjs(dateFilter.toDate).format('YYYY-MM-DD') }
      : {}),
  }),
  [userSlug, dateFilter, sortDir],
)
```

- [ ] **Step 10: Update `isDateActive` to also reflect non-default sort**

Find (around line 725):

```ts
const isDateActive = dateFilter.fromDate !== null || dateFilter.toDate !== null
```

Replace with:

```ts
const isDateActive =
  dateFilter.fromDate !== null ||
  dateFilter.toDate !== null ||
  sortDir !== '-createdAt'
```

- [ ] **Step 11: Add scroll-reset effect for `sortDir`**

Find the two existing `useEffect` scroll-reset hooks (around lines 703–710). After them, add:

```ts
useEffect(() => {
  flashListRef.current?.scrollToOffset({ offset: 0, animated: false })
}, [sortDir])
```

- [ ] **Step 12: Pass `selectedSort` and `onSortChange` to `DateFilterSheet`**

Find the `<DateFilterSheet ... />` usage (around line 910):

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

Replace with:

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
  selectedSort={sortDir}
  onSortChange={handleSortChange}
/>
```

- [ ] **Step 13: Run typecheck + lint**

```bash
npm run check
```

Expected: exits 0 with no errors.

- [ ] **Step 14: Commit**

```bash
git add app/profile/gift-card-orders.tsx
git commit -m "feat(gift-card): add sort toggle (newest/oldest) to filter sheet"
```

---

## Task 3: Food Order History — Date Range Filter

**Files:**

- Modify: `app/profile/history.tsx`

Context: `OrderHistoryPage` is the main component (lines ~103–470). The floating header (lines ~407–466) currently has a `[back btn] [title] [spacer View]` layout. The `listPadding` style has `paddingTop: 130` to clear the floating header.

- [ ] **Step 1: Add missing imports**

Find the existing lucide import line (around line 5):

```ts
import { ChevronLeft, Package } from 'lucide-react-native'
```

Replace with:

```ts
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  Package,
  SlidersHorizontal,
  X,
} from 'lucide-react-native'
```

Find the existing React import (line 6):

```ts
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

Replace with:

```ts
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
```

Add these new imports after the existing `react-native` block (after line 16):

```ts
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import dayjs from 'dayjs'
import DatePicker from 'react-native-date-picker'
import { TouchableOpacity as GHTouchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
```

- [ ] **Step 2: Add `HistoryDateFilter` type and `HistoryDateFilterSheet` component**

Insert this block immediately before the `function OrderHistoryPage()` declaration (before line 103):

```tsx
// ─── History date filter types ────────────────────────────────────────────────

interface HistoryDateFilter {
  fromDate: Date | null
  toDate: Date | null
}

// ─── History date filter sheet ────────────────────────────────────────────────

const HISTORY_FILTER_SNAP = ['50%']

const HistoryDateFilterSheet = memo(function HistoryDateFilterSheet({
  visible,
  value,
  primaryColor,
  isDark,
  onClose,
  onApply,
}: {
  visible: boolean
  value: HistoryDateFilter
  primaryColor: string
  isDark: boolean
  onClose: () => void
  onApply: (v: HistoryDateFilter) => void
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom } = useSafeAreaInsets()
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')

  const [localFrom, setLocalFrom] = useState<Date | null>(value.fromDate)
  const [localTo, setLocalTo] = useState<Date | null>(value.toDate)
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)
  const defaultNow = useMemo(() => new Date(), [])

  const bg = isDark ? colors.card.dark : colors.white.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const chipBg = isDark ? colors.border.dark : colors.gray[100]
  const dateBg = isDark ? colors.background.dark : colors.gray[50]
  const dateBorder = isDark ? colors.border.dark : colors.gray[200]

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  )

  const handleApply = useCallback(() => {
    onApply({ fromDate: localFrom, toDate: localTo })
    sheetRef.current?.dismiss()
  }, [localFrom, localTo, onApply])

  const handleReset = useCallback(() => {
    onApply({ fromDate: null, toDate: null })
    sheetRef.current?.dismiss()
  }, [onApply])

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={HISTORY_FILTER_SNAP}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: bg }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? colors.gray[600] : colors.gray[300],
      }}
      onDismiss={onClose}
    >
      <View style={[hfs.content, { paddingBottom: bottom + 16 }]}>
        <View>
          <Text style={[hfs.title, { color: textColor }]}>
            {t('order.filterTitle')}
          </Text>
          <Text style={[hfs.sectionLabel, { color: subColor }]}>
            {t('order.dateRange')}
          </Text>
          <View style={hfs.dateRow}>
            {/* From */}
            <View style={hfs.dateWrap}>
              <GHTouchable
                onPress={() => setFromOpen(true)}
                activeOpacity={0.7}
                style={[
                  hfs.datePicker,
                  {
                    backgroundColor: dateBg,
                    borderColor: localFrom ? primaryColor : dateBorder,
                  },
                ]}
              >
                <CalendarDays
                  size={13}
                  color={localFrom ? primaryColor : subColor}
                />
                <View style={hfs.dateText}>
                  <Text style={[hfs.dateHint, { color: subColor }]}>
                    {t('order.fromDate')}
                  </Text>
                  <Text
                    style={[
                      hfs.dateVal,
                      { color: localFrom ? textColor : subColor },
                    ]}
                  >
                    {localFrom
                      ? dayjs(localFrom).format('DD/MM/YYYY')
                      : '––/––/––––'}
                  </Text>
                </View>
                {localFrom && (
                  <GHTouchable onPress={() => setLocalFrom(null)} hitSlop={10}>
                    <X size={12} color={subColor} />
                  </GHTouchable>
                )}
              </GHTouchable>
            </View>

            <ArrowRight size={16} color={subColor} />

            {/* To */}
            <View style={hfs.dateWrap}>
              <GHTouchable
                onPress={() => setToOpen(true)}
                activeOpacity={0.7}
                style={[
                  hfs.datePicker,
                  {
                    backgroundColor: dateBg,
                    borderColor: localTo ? primaryColor : dateBorder,
                  },
                ]}
              >
                <CalendarDays
                  size={13}
                  color={localTo ? primaryColor : subColor}
                />
                <View style={hfs.dateText}>
                  <Text style={[hfs.dateHint, { color: subColor }]}>
                    {t('order.toDate')}
                  </Text>
                  <Text
                    style={[
                      hfs.dateVal,
                      { color: localTo ? textColor : subColor },
                    ]}
                  >
                    {localTo
                      ? dayjs(localTo).format('DD/MM/YYYY')
                      : '––/––/––––'}
                  </Text>
                </View>
                {localTo && (
                  <GHTouchable onPress={() => setLocalTo(null)} hitSlop={10}>
                    <X size={12} color={subColor} />
                  </GHTouchable>
                )}
              </GHTouchable>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={hfs.footer}>
          <View style={hfs.btnWrap}>
            <GHTouchable
              onPress={handleReset}
              activeOpacity={0.8}
              style={[hfs.btn, { backgroundColor: chipBg }]}
            >
              <Text
                style={[
                  hfs.btnText,
                  { color: isDark ? colors.gray[50] : colors.gray[700] },
                ]}
              >
                {tCommon('common.reset')}
              </Text>
            </GHTouchable>
          </View>
          <View style={hfs.btnWrap}>
            <GHTouchable
              onPress={handleApply}
              activeOpacity={0.8}
              style={[hfs.btn, { backgroundColor: primaryColor }]}
            >
              <Text style={[hfs.btnText, { color: colors.white.light }]}>
                {t('order.filterApply')}
              </Text>
            </GHTouchable>
          </View>
        </View>
      </View>

      <DatePicker
        modal
        open={fromOpen}
        date={localFrom ?? defaultNow}
        mode="date"
        maximumDate={localTo ?? defaultNow}
        onConfirm={(d) => {
          setLocalFrom(d)
          setFromOpen(false)
        }}
        onCancel={() => setFromOpen(false)}
        confirmText={tCommon('common.confirm')}
        cancelText={tCommon('common.cancel')}
        theme={isDark ? 'dark' : 'light'}
      />
      <DatePicker
        modal
        open={toOpen}
        date={localTo ?? defaultNow}
        mode="date"
        minimumDate={localFrom ?? undefined}
        maximumDate={defaultNow}
        onConfirm={(d) => {
          setLocalTo(d)
          setToOpen(false)
        }}
        onCancel={() => setToOpen(false)}
        confirmText={tCommon('common.confirm')}
        cancelText={tCommon('common.cancel')}
        theme={isDark ? 'dark' : 'light'}
      />
    </BottomSheetModal>
  )
})

const hfs = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateWrap: { flex: 1 },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 52,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  dateText: { flex: 1, gap: 2 },
  dateHint: { fontSize: 10, fontWeight: '500' },
  dateVal: { fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10 },
  btnWrap: { flex: 1 },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
})
```

- [ ] **Step 3: Add `dateFilter` and `filterSheetOpen` state + handlers in `OrderHistoryPage`**

Find the state declarations in `OrderHistoryPage` (around lines 111–118). After `const [allowFetch, setAllowFetch] = useState(false)`, add:

```ts
const [dateFilter, setDateFilter] = useState<HistoryDateFilter>({
  fromDate: null,
  toDate: null,
})
const [filterSheetOpen, setFilterSheetOpen] = useState(false)
```

Find the handlers block (around lines 224–234). After `handleFilterSelect`, add:

```ts
const handleFilterOpen = useCallback(() => setFilterSheetOpen(true), [])
const handleFilterClose = useCallback(() => setFilterSheetOpen(false), [])
const handleFilterApply = useCallback((v: HistoryDateFilter) => {
  setDateFilter(v)
  setPage(1)
  setFilterSheetOpen(false)
}, [])
```

- [ ] **Step 4: Derive `isDateFilterActive` and dynamic `listPaddingStyle`**

Find the line that assigns `screenBg` (around line 358):

```ts
const screenBg = isDark ? colors.background.dark : colors.background.light
```

Add after it:

```ts
const isDateFilterActive =
  dateFilter.fromDate !== null || dateFilter.toDate !== null

const listPaddingStyle = useMemo(
  () => ({
    paddingHorizontal: 16,
    paddingTop: isDateFilterActive ? 168 : 130,
    paddingBottom: 24,
  }),
  [isDateFilterActive],
)
```

- [ ] **Step 5: Update `useOrders` to pass `startDate`/`endDate`**

Find the `useOrders` call (around lines 119–134):

```ts
const {
  data: orderResponse,
  isPending,
  refetch,
  isRefetching,
} = useOrders(
  {
    page,
    size: pageSize,
    owner: userInfo?.slug,
    order: 'DESC',
    hasPaging: true,
    status: status === OrderStatus.ALL ? undefined : status,
  },
  { enabled: allowFetch && !!userInfo?.slug },
)
```

Replace with:

```ts
const {
  data: orderResponse,
  isPending,
  refetch,
  isRefetching,
} = useOrders(
  {
    page,
    size: pageSize,
    owner: userInfo?.slug,
    order: 'DESC',
    hasPaging: true,
    status: status === OrderStatus.ALL ? undefined : status,
    ...(dateFilter.fromDate
      ? { startDate: dayjs(dateFilter.fromDate).format('YYYY-MM-DD') }
      : {}),
    ...(dateFilter.toDate
      ? { endDate: dayjs(dateFilter.toDate).format('YYYY-MM-DD') }
      : {}),
  },
  { enabled: allowFetch && !!userInfo?.slug },
)
```

- [ ] **Step 6: Replace the spacer `<View>` in the header row with the filter button**

Find the header row spacer (around line 452):

```tsx
<View style={pageStyles.circleBtn} />
```

Replace with:

```tsx
<Pressable
  onPress={handleFilterOpen}
  hitSlop={4}
  style={[
    pageStyles.circleBtn,
    {
      backgroundColor: isDateFilterActive
        ? `${primaryColor}15`
        : isDark
          ? colors.card.dark
          : colors.white.light,
    },
    !isDateFilterActive && pageStyles.shadow,
  ]}
>
  <SlidersHorizontal
    size={18}
    color={
      isDateFilterActive
        ? primaryColor
        : isDark
          ? colors.gray[50]
          : colors.gray[900]
    }
  />
  {isDateFilterActive && (
    <View
      style={[pageStyles.filterActiveDot, { backgroundColor: primaryColor }]}
    />
  )}
</Pressable>
```

- [ ] **Step 7: Add date chips row below the filter bar in the floating header**

Find the filter chips row in the floating header (around line 455):

```tsx
{
  /* Filter chips */
}
;<View style={pageStyles.filterRow} pointerEvents="auto">
  <FilterBar
    status={status}
    isPending={isPending}
    primaryColor={primaryColor}
    isDark={isDark}
    onSelect={handleFilterSelect}
    labels={filterBarLabels}
  />
</View>
```

Replace with:

```tsx
{
  /* Filter chips */
}
;<View style={pageStyles.filterRow} pointerEvents="auto">
  <FilterBar
    status={status}
    isPending={isPending}
    primaryColor={primaryColor}
    isDark={isDark}
    onSelect={handleFilterSelect}
    labels={filterBarLabels}
  />
</View>

{
  /* Active date chips */
}
{
  isDateFilterActive && (
    <View style={pageStyles.dateChipRow} pointerEvents="auto">
      {dateFilter.fromDate && (
        <View
          style={[
            pageStyles.dateChip,
            {
              backgroundColor: `${primaryColor}15`,
              borderColor: `${primaryColor}30`,
            },
          ]}
        >
          <Text style={[pageStyles.dateChipText, { color: primaryColor }]}>
            {t('order.fromDate')}:{' '}
            {dayjs(dateFilter.fromDate).format('DD/MM/YYYY')}
          </Text>
        </View>
      )}
      {dateFilter.toDate && (
        <View
          style={[
            pageStyles.dateChip,
            {
              backgroundColor: `${primaryColor}15`,
              borderColor: `${primaryColor}30`,
            },
          ]}
        >
          <Text style={[pageStyles.dateChipText, { color: primaryColor }]}>
            {t('order.toDate')}: {dayjs(dateFilter.toDate).format('DD/MM/YYYY')}
          </Text>
        </View>
      )}
      <Pressable
        onPress={() => {
          setDateFilter({ fromDate: null, toDate: null })
          setPage(1)
        }}
        hitSlop={8}
      >
        <X size={14} color={isDark ? colors.gray[400] : colors.gray[500]} />
      </Pressable>
    </View>
  )
}
```

- [ ] **Step 8: Update `contentContainerStyle` on `FlashList` to use `listPaddingStyle`**

Find (around line 395):

```tsx
          contentContainerStyle={pageStyles.listPadding}
```

Replace with:

```tsx
contentContainerStyle = { listPaddingStyle }
```

- [ ] **Step 9: Render `HistoryDateFilterSheet` in the JSX**

Find the closing `</ScreenContainer>` and `</View>` at the end of the render return (around lines 467–469):

```tsx
      </ScreenContainer>
    </View>
  )
```

Replace with:

```tsx
      </ScreenContainer>

      <HistoryDateFilterSheet
        visible={filterSheetOpen}
        value={dateFilter}
        primaryColor={primaryColor}
        isDark={isDark}
        onClose={handleFilterClose}
        onApply={handleFilterApply}
      />
    </View>
  )
```

- [ ] **Step 10: Add new styles to `pageStyles` StyleSheet**

Find the `pageStyles` StyleSheet at the bottom of the file (around line 483). Add new entries inside it after `emptyDesc`:

```ts
  filterActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 6,
    right: 6,
  },
  dateChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateChipText: { fontSize: 11, fontWeight: '600' },
```

- [ ] **Step 11: Run typecheck + lint**

```bash
npm run check
```

Expected: exits 0 with no errors.

- [ ] **Step 12: Commit**

```bash
git add app/profile/history.tsx
git commit -m "feat(history): add date range filter to food order history screen"
```
