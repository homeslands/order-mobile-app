# Filter Chip & Dark Mode Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify filter chip style (pill shape, Pressable) across all filter sheets and fix remaining dark mode color issues in the redeem gift card screen.

**Architecture:** Pure color/style substitutions — no logic changes. All filter chips move from `GHTouchable`+`View` wrapper to `Pressable`, adopt `borderRadius: 999`, `paddingVertical: 7`, `paddingHorizontal: 14`. The redeem screen fixes `gray[900/800]` dark-mode colors to canonical `card.dark`/`border.dark`/`background.dark` and makes `iconCircle` background dynamic.

**Tech Stack:** React Native (`Pressable`), `StyleSheet`, `@/constants/colors`

---

## Files

| File                                                      | Change                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `app/gift-card/redeem.tsx`                                | Fix 6 dark-mode color values (RedeemSuccess + main screen) |
| `components/gift-card/gift-card-filter-sheet.tsx`         | Chip shape: `borderRadius: 10→999`, padding update         |
| `app/profile/gift-card-orders.tsx`                        | DateFilterSheet type chips: `GHTouchable` → `Pressable`    |
| `components/coin/coin-filter-sheet.tsx`                   | Chip: `View`+`GHTouchable` → `Pressable`, pill shape       |
| `components/loyalty-point/loyalty-point-filter-sheet.tsx` | Same as coin                                               |

---

### Task 1: Fix dark mode in redeem.tsx

**Files:**

- Modify: `app/gift-card/redeem.tsx`

**Context:**

- `RedeemSuccess` (lines 60-62): uses `colors.gray[900]` as dark card bg, `colors.gray[800]` as dark border and dark row bg. Must use canonical palette.
- `sc.iconCircle` (line 143): static `backgroundColor: '#dcfce7'` — no dark variant. The `RedeemSuccess` component receives `isDark` prop, so apply override via inline style.
- Main screen (lines 235, 238): same `gray[900]`/`gray[800]` issues for `cardBg`/`borderColor`.

Canonical palette:

- dark card bg → `colors.card.dark` (`'#1c1c1e'`)
- dark border → `colors.border.dark` (`'#2e2e2e'`)
- dark row/inner bg → `colors.background.dark` (`'#121212'`)
- icon circle light → `colors.success.iconBgLight` (`'#dcfce7'`)
- icon circle dark → `colors.success.iconBgDark` (`'#166534'`)

- [ ] **Step 1: Fix RedeemSuccess color variables**

In `app/gift-card/redeem.tsx`, replace lines 60-62:

```tsx
const cardBg = isDark ? colors.gray[900] : colors.white.light
const borderColor = isDark ? colors.gray[800] : colors.gray[100]
const rowBg = isDark ? colors.gray[800] : colors.gray[50]
```

With:

```tsx
const cardBg = isDark ? colors.card.dark : colors.white.light
const borderColor = isDark ? colors.border.dark : colors.gray[100]
const rowBg = isDark ? colors.background.dark : colors.gray[50]
```

- [ ] **Step 2: Make iconCircle background dynamic**

In `app/gift-card/redeem.tsx`, find the JSX inside `RedeemSuccess` (around line 68):

```tsx
        <View style={sc.iconCircle}>
```

Replace with:

```tsx
        <View style={[sc.iconCircle, { backgroundColor: isDark ? colors.success.iconBgDark : colors.success.iconBgLight }]}>
```

Then remove `backgroundColor` from the `sc.iconCircle` StyleSheet entry (around line 138-145):

```ts
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
```

Replace with:

```ts
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
```

- [ ] **Step 3: Fix main screen cardBg and borderColor**

In `app/gift-card/redeem.tsx`, find lines 235 and 238:

```ts
const cardBg = isDark ? colors.gray[900] : colors.white.light
const textColor = isDark ? colors.gray[50] : colors.gray[900]
const subColor = isDark ? colors.gray[400] : colors.gray[500]
const borderColor = isDark ? colors.gray[800] : colors.gray[100]
```

Replace with:

```ts
const cardBg = isDark ? colors.card.dark : colors.white.light
const textColor = isDark ? colors.gray[50] : colors.gray[900]
const subColor = isDark ? colors.gray[400] : colors.gray[500]
const borderColor = isDark ? colors.border.dark : colors.gray[100]
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/gift-card/redeem.tsx
git commit -m "fix(gift-card): sync dark mode colors in redeem screen"
```

---

### Task 2: Update chip shape in gift-card-filter-sheet.tsx

**Files:**

- Modify: `components/gift-card/gift-card-filter-sheet.tsx`

**Context:**
The sheet already uses `Pressable` (fixed in a prior session). Only the geometry needs updating: `borderRadius: 10→999`, `paddingVertical: 10→7`, add `paddingHorizontal: 14`.

Current `fs.chip` (around line 393-400):

```ts
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 1: Update fs.chip**

In `components/gift-card/gift-card-filter-sheet.tsx`, replace:

```ts
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

With:

```ts
  chip: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/gift-card/gift-card-filter-sheet.tsx
git commit -m "fix(gift-card): update filter chip to pill shape"
```

---

### Task 3: Replace GHTouchable with Pressable in DateFilterSheet type chips

**Files:**

- Modify: `app/profile/gift-card-orders.tsx`

**Context:**
`DateFilterSheet` (inside gift-card-orders.tsx) has type filter chips using `GHTouchable` from react-native-gesture-handler. With `flex` layout and no fixed height, GHTouchable's internal `Animated.View` wrapper can collapse and clip text. Replace with `Pressable` from React Native, which handles flex correctly.

`ds.typeChip` already has the correct pill style: `borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7`. No style change needed — only the component changes.

Current JSX (around lines 386-416):

```tsx
{
  TYPE_FILTER_OPTIONS.map((opt) => {
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
  })
}
```

- [ ] **Step 1: Replace GHTouchable with Pressable for type chips**

In `app/profile/gift-card-orders.tsx`, inside `DateFilterSheet`, replace the chip map block:

```tsx
{
  TYPE_FILTER_OPTIONS.map((opt) => {
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
  })
}
```

With:

```tsx
{
  TYPE_FILTER_OPTIONS.map((opt) => {
    const active = selectedType === opt.value
    return (
      <Pressable
        key={opt.value}
        onPress={() => onTypeChange(opt.value)}
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
      </Pressable>
    )
  })
}
```

Note: `Pressable` is already imported from `'react-native'` at the top of this file. `GHTouchable` import stays because it's still used in the date picker buttons in `DateFilterSheet` and the footer buttons.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/profile/gift-card-orders.tsx
git commit -m "fix(gift-card): replace GHTouchable with Pressable for order filter type chips"
```

---

### Task 4: Fix chips in coin-filter-sheet.tsx

**Files:**

- Modify: `components/coin/coin-filter-sheet.tsx`

**Context:**
Currently the chip pattern uses a `View` wrapper + `GHTouchable` inside:

```tsx
<View key={String(opt.value)} style={fs.chipWrap}>
  <GHTouchable onPress={...} activeOpacity={0.7} style={[fs.chip, { backgroundColor: ... }]}>
    <Text ...>{opt.label}</Text>
  </GHTouchable>
</View>
```

Replace with a single `Pressable` that merges both styles.

Also update `fs.chip` shape: `borderRadius: 10→999`, `paddingVertical: 10→7`, `paddingHorizontal: 12→14`.

`Pressable` must be added to the `react-native` import.

- [ ] **Step 1: Add Pressable to react-native import**

In `components/coin/coin-filter-sheet.tsx`, find line 21:

```ts
import { StyleSheet, Text, View } from 'react-native'
```

Replace with:

```ts
import { Pressable, StyleSheet, Text, View } from 'react-native'
```

- [ ] **Step 2: Replace chip map block**

Find the chip map (around lines 164-195):

```tsx
<View style={fs.chipRow}>
  {TYPE_OPTIONS.map((opt) => {
    const active = opt.value === localType
    return (
      <View key={String(opt.value)} style={fs.chipWrap}>
        <GHTouchable
          onPress={() => handleSelectType(opt.value)}
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
            numberOfLines={1}
          >
            {opt.label}
          </Text>
        </GHTouchable>
      </View>
    )
  })}
</View>
```

Replace with:

```tsx
<View style={fs.chipRow}>
  {TYPE_OPTIONS.map((opt) => {
    const active = opt.value === localType
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => handleSelectType(opt.value)}
        style={[
          fs.chip,
          fs.chipWrap,
          { backgroundColor: active ? primaryColor : chipBg },
        ]}
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
          numberOfLines={1}
        >
          {opt.label}
        </Text>
      </Pressable>
    )
  })}
</View>
```

- [ ] **Step 3: Update chip style to pill shape**

Find `fs.chip` in the StyleSheet (around lines 389-394):

```ts
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

Replace with:

```ts
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/coin/coin-filter-sheet.tsx
git commit -m "fix(coin): replace GHTouchable with Pressable, update chip to pill shape"
```

---

### Task 5: Fix chips in loyalty-point-filter-sheet.tsx

**Files:**

- Modify: `components/loyalty-point/loyalty-point-filter-sheet.tsx`

**Context:**
Identical chip pattern to coin-filter-sheet.tsx. Multi-select logic (toggle array) is different but the component structure is the same: `View`+`GHTouchable` → `Pressable`, same style updates.

- [ ] **Step 1: Add Pressable to react-native import**

In `components/loyalty-point/loyalty-point-filter-sheet.tsx`, find line 21:

```ts
import { StyleSheet, Text, View } from 'react-native'
```

Replace with:

```ts
import { Pressable, StyleSheet, Text, View } from 'react-native'
```

- [ ] **Step 2: Replace chip map block**

Find the chip map (around lines 181-215):

```tsx
<View style={fs.chipRow}>
  {TYPE_OPTIONS.map((opt) => {
    const isAllChip = opt.value === null
    const active = isAllChip
      ? localTypes.length === 0
      : opt.value !== null && localTypes.includes(opt.value)
    return (
      <View key={String(opt.value)} style={fs.chipWrap}>
        <GHTouchable
          onPress={() => handleToggleType(opt.value)}
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
            numberOfLines={1}
          >
            {opt.label}
          </Text>
        </GHTouchable>
      </View>
    )
  })}
</View>
```

Replace with:

```tsx
<View style={fs.chipRow}>
  {TYPE_OPTIONS.map((opt) => {
    const isAllChip = opt.value === null
    const active = isAllChip
      ? localTypes.length === 0
      : opt.value !== null && localTypes.includes(opt.value)
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => handleToggleType(opt.value)}
        style={[
          fs.chip,
          fs.chipWrap,
          { backgroundColor: active ? primaryColor : chipBg },
        ]}
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
          numberOfLines={1}
        >
          {opt.label}
        </Text>
      </Pressable>
    )
  })}
</View>
```

- [ ] **Step 3: Update chip style to pill shape**

Find `fs.chip` in the StyleSheet (around lines 408-413):

```ts
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

Replace with:

```ts
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/loyalty-point/loyalty-point-filter-sheet.tsx
git commit -m "fix(loyalty-point): replace GHTouchable with Pressable, update chip to pill shape"
```
