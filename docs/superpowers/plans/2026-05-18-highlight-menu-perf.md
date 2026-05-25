# Highlight Menu Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ re-render thừa, race condition, và vi phạm threading rule trong `HighlightMenuCarousel` để carousel đạt 60fps ổn định và không gây JS thread spike khi chuyển màn.

**Architecture:** Tất cả thay đổi trong một file duy nhất `components/home/highlight-menu.tsx`. 6 tasks độc lập, thực hiện tuần tự từ tác động lớn (CRITICAL) đến nhỏ (LOW). Không tạo file mới, không thay đổi public API của component.

**Tech Stack:** React Native, React Query v5 (`useQueryClient`, `prefetchQuery`, `getQueryData`), Reanimated 4.1, `@shopify/flash-list`, Zustand selectors, `scheduleTransitionTask`.

---

## File Map

| File                                 | Action | Trách nhiệm    |
| ------------------------------------ | ------ | -------------- |
| `components/home/highlight-menu.tsx` | Modify | Tất cả 6 tasks |

---

### Task 1 (CRITICAL): Bỏ `useCatalog()` subscription — lazy read + scheduleTransitionTask

**Files:**

- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh:**

Hiện tại `useCatalog()` (line 233) khiến toàn bộ `HighlightMenuCarousel` re-render mỗi khi React Query refetch catalog (mỗi 30s, mỗi lần focus, mỗi khi network reconnect). Carousel chỉ cần catalog khi user nhấn một card — không cần subscribe reactive.

Đồng thời `setMenuFilter` chạy inline TRƯỚC `router.push` (line 303-307) gây Zustand write + AsyncStorage persist block JS thread ngay trong lúc animation home→menu đang chạy.

Fix: (1) Đọc catalog lazy qua `queryClient.getQueryData` khi nhấn. (2) Warm cache bằng `prefetchQuery` không subscription khi mount. (3) `router.push` trước, `setMenuFilter` trong `scheduleTransitionTask` sau.

- [ ] **Step 1: Cập nhật imports**

Xoá 2 dòng:

```tsx
import { useCatalog } from '@/hooks'
import { useMenuFilterStore } from '@/stores'
```

Thêm vào đầu block `@/` imports (sau `import { Images } from '@/assets/images'`):

```tsx
import { useQueryClient } from '@tanstack/react-query'

import { getCatalog } from '@/api'
import { QUERYKEY } from '@/constants'
import type { IApiResponse, ICatalog } from '@/types'
import { scheduleTransitionTask } from '@/lib/navigation'
import { useSetMenuFilter } from '@/stores/selectors/menu-filter.selectors'
```

File imports sau khi sửa (toàn bộ, giữ nguyên thứ tự):

```tsx
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageSourcePropType } from 'react-native'
import { Pressable, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useQueryClient } from '@tanstack/react-query'

import { getCatalog } from '@/api'
import { Images } from '@/assets/images'
import { QUERYKEY } from '@/constants'
import type { IApiResponse, ICatalog } from '@/types'
import { scheduleTransitionTask } from '@/lib/navigation'
import { useSetMenuFilter } from '@/stores/selectors/menu-filter.selectors'
```

- [ ] **Step 2: Thay `useCatalog()` và `useMenuFilterStore` trong `HighlightMenuCarousel`**

Tìm 2 dòng (khoảng line 233-234):

```tsx
const { data: catalogResponse } = useCatalog()
const setMenuFilter = useMenuFilterStore((s) => s.setMenuFilter)
```

Thay thành:

```tsx
const queryClient = useQueryClient()
const setMenuFilter = useSetMenuFilter()
```

- [ ] **Step 3: Thêm `prefetchQuery` useEffect để warm catalog cache khi mount**

Thêm sau block khai báo `queryClient`/`setMenuFilter` vừa sửa (trước phần khai báo `cardWidth`):

```tsx
useEffect(() => {
  queryClient.prefetchQuery({
    queryKey: [QUERYKEY.catalog],
    queryFn: () => getCatalog(),
  })
}, [queryClient])
```

- [ ] **Step 4: Thay thế `handleItemPress`**

Tìm `handleItemPress` (khoảng line 297) và thay toàn bộ:

```tsx
// Xoá:
const handleItemPress = useCallback(
  (catalogSearch: string) => {
    const catalogs = catalogResponse?.result ?? []
    const matched = catalogs.find((c) =>
      c.name.toLowerCase().includes(catalogSearch.toLowerCase()),
    )
    setMenuFilter((prev) => ({
      ...prev,
      catalog: matched?.slug ?? undefined,
    }))
    router.push('/(tabs)/menu' as never)
  },
  [catalogResponse, setMenuFilter, router],
)

// Thêm:
const handleItemPress = useCallback(
  (catalogSearch: string) => {
    const cached = queryClient.getQueryData<IApiResponse<ICatalog[]>>([
      QUERYKEY.catalog,
    ])
    const needle = catalogSearch.toLowerCase()
    const matched = cached?.result?.find((c) =>
      c.name.toLowerCase().includes(needle),
    )
    router.push('/(tabs)/menu' as never)
    scheduleTransitionTask(() => {
      setMenuFilter((prev) => ({
        ...prev,
        catalog: matched?.slug ?? undefined,
      }))
    })
  },
  [queryClient, setMenuFilter, router],
)
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): lazy-read catalog on press, prefetch on mount, scheduleTransitionTask"
```

---

### Task 2 (HIGH): FlashList — estimatedItemSize + keyExtractor + scrollEventThrottle

**Files:**

- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh:**

3 vấn đề FlashList cần fix cùng lúc:

- Thiếu `estimatedItemSize` → FlashList không thể recycle view đúng cách (bắt buộc theo CLAUDE.md)
- `keyExtractor` dùng `index` thay vì `item.id` → clone collision khi teleport, FlashList tear-down cell không cần thiết
- `scrollEventThrottle={16}` không có tác dụng với Reanimated worklet handler — nên set `1`

- [ ] **Step 1: Sửa `keyExtractor` để dùng `item.id`**

Tìm `keyExtractor` (khoảng line 329) và thay:

```tsx
// Xoá:
const keyExtractor = useCallback(
  (_item: HighlightMenuItem, index: number) => `hl-${index}`,
  [],
)

// Thêm:
const keyExtractor = useCallback(
  (item: HighlightMenuItem, index: number) => {
    if (index === 0) return `hl-clone-last-${item.id}`
    if (index === count + 1) return `hl-clone-first-${item.id}`
    return `hl-${item.id}`
  },
  [count],
)
```

- [ ] **Step 2: Thêm `estimatedItemSize` và sửa `scrollEventThrottle` trong JSX**

Tìm `<AnimatedFlashList` trong JSX và sửa 2 props:

```tsx
// Trước:
<AnimatedFlashList
  ref={listRef as React.Ref<FlashListRef<HighlightMenuItem>>}
  data={extendedMenus}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  horizontal
  showsHorizontalScrollIndicator={false}
  onScroll={scrollHandler}
  scrollEventThrottle={16}
  snapToInterval={step}
  decelerationRate="fast"
  contentContainerStyle={listContentStyle}
  onMomentumScrollEnd={handleScrollEnd}
/>

// Sau:
<AnimatedFlashList
  ref={listRef as React.Ref<FlashListRef<HighlightMenuItem>>}
  data={extendedMenus}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  estimatedItemSize={step}
  horizontal
  showsHorizontalScrollIndicator={false}
  onScroll={scrollHandler}
  scrollEventThrottle={1}
  snapToInterval={step}
  decelerationRate="fast"
  contentContainerStyle={listContentStyle}
  onMomentumScrollEnd={handleScrollEnd}
/>
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): add estimatedItemSize, fix keyExtractor and scrollEventThrottle"
```

---

### Task 3 (HIGH): Xoá JS-thread `scrollX.value` write race trong `handleScrollEnd`

**Files:**

- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh:**

`handleScrollEnd` (khoảng line 277) hiện ghi `scrollX.value = target` từ JS thread ngay sau `scrollToOffset`. Nhưng `scrollToOffset({ animated: false })` trigger native scroll event → Reanimated worklet `scrollHandler` cũng sẽ update `scrollX.value` với cùng offset đó. Hai write đến cùng `SharedValue` trong cùng frame gây race condition có thể làm animation jump ở biên carousel.

Fix: bỏ 2 dòng JS write, let worklet handle tự nhiên qua `onScroll`. Cũng xoá `scrollX` khỏi dep array của `handleScrollEnd`.

- [ ] **Step 1: Xoá `scrollX.value = target` trong `handleScrollEnd`**

```tsx
// Trước:
const handleScrollEnd = useCallback(
  (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (count <= 1) return
    const rawIndex = Math.round(e.nativeEvent.contentOffset.x / step)

    if (rawIndex === 0) {
      const target = count * step
      listRef.current?.scrollToOffset({ offset: target, animated: false })
      scrollX.value = target
    } else if (rawIndex === count + 1) {
      const target = step
      listRef.current?.scrollToOffset({ offset: target, animated: false })
      scrollX.value = target
    }
  },
  [count, step, scrollX],
)

// Sau:
const handleScrollEnd = useCallback(
  (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (count <= 1) return
    const rawIndex = Math.round(e.nativeEvent.contentOffset.x / step)

    if (rawIndex === 0) {
      listRef.current?.scrollToOffset({ offset: count * step, animated: false })
    } else if (rawIndex === count + 1) {
      listRef.current?.scrollToOffset({ offset: step, animated: false })
    }
  },
  [count, step],
)
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "fix(home): remove JS-thread scrollX write race in handleScrollEnd"
```

---

### Task 4 (MEDIUM): `useMemo` cho card dimensions và `highlightMenus`

**Files:**

- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh:**

`cardWidth`, `cardHeight`, `sideInset`, `step` được tính inline mỗi render. Khi `screenWidth` không đổi (thường xuyên), các giá trị này vẫn stable vì là primitives — nhưng khi `useWindowDimensions` trả về object mới (keyboard show trên Android, font-scale change), dep chain cascade xuống `renderItem` và buộc tất cả card re-render. Dùng `useMemo` để gom vào một dep duy nhất (`screenWidth`).

`highlightMenus = items ?? DEFAULT_HIGHLIGHT_MENUS` không memoized — nếu parent truyền `items` mới mỗi render, `extendedMenus` rebuild và FlashList bị invalidate.

- [ ] **Step 1: Wrap card dimensions vào `useMemo`**

Tìm 4 dòng khai báo riêng lẻ (khoảng line 236-241):

```tsx
// Xoá:
const cardWidth = screenWidth * 0.72
const cardHeight = cardWidth * 1.28
// sideInset bù CARD_GAP/2 vì mỗi card có marginHorizontal = CARD_GAP/2.
// Đảm bảo card trung tâm luôn căn đúng giữa màn hình.
const sideInset = (screenWidth - cardWidth) / 2 - CARD_GAP / 2
const step = cardWidth + CARD_GAP

// Thêm:
const { cardWidth, cardHeight, sideInset, step } = useMemo(() => {
  const w = screenWidth * 0.72
  const h = w * 1.28
  return {
    cardWidth: w,
    cardHeight: h,
    // sideInset bù CARD_GAP/2 vì mỗi card có marginHorizontal = CARD_GAP/2.
    // Đảm bảo card trung tâm luôn căn đúng giữa màn hình.
    sideInset: (screenWidth - w) / 2 - CARD_GAP / 2,
    step: w + CARD_GAP,
  }
}, [screenWidth])
```

- [ ] **Step 2: Wrap `highlightMenus` vào `useMemo`**

Tìm dòng (khoảng line 230):

```tsx
// Xoá:
const highlightMenus = items ?? DEFAULT_HIGHLIGHT_MENUS

// Thêm:
const highlightMenus = useMemo(() => items ?? DEFAULT_HIGHLIGHT_MENUS, [items])
```

Dòng `const count = highlightMenus.length` giữ nguyên, chỉ đảm bảo nó nằm SAU `useMemo` trên.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): memoize card dimensions and highlightMenus"
```

---

### Task 5 (MEDIUM): Chuyển `t` vào `HighlightCard` + bỏ `backgroundColor` ra khỏi `Dot` worklet

**Files:**

- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh:**

`t` từ `useTranslation` được pass như prop xuống `HighlightCard`, tức là `renderItem` depends on `t`. Mỗi khi i18n thay đổi locale (ít xảy ra nhưng vẫn là dep) hoặc bất kỳ re-render nào của `HighlightMenuCarousel`, `renderItem` có thể mất stability. Giải pháp tốt hơn: mỗi `HighlightCard` tự subscribe `useTranslation` — phù hợp với pattern của project và không ảnh hưởng perf vì card đã cần re-render khi locale đổi.

`Dot` worklet trả về `backgroundColor: primaryColor` mỗi frame — đây là constant, không cần ở trong worklet.

- [ ] **Step 1: Xoá `t` khỏi `HighlightCardProps`**

Tìm interface `HighlightCardProps` và xoá field `t`:

```tsx
// Trước:
interface HighlightCardProps {
  item: HighlightMenuItem
  extendedIndex: number
  scrollX: SharedValue<number>
  cardWidth: number
  cardHeight: number
  step: number
  t: (key: string) => string
  onPress: (catalogSearch: string) => void
}

// Sau:
interface HighlightCardProps {
  item: HighlightMenuItem
  extendedIndex: number
  scrollX: SharedValue<number>
  cardWidth: number
  cardHeight: number
  step: number
  onPress: (catalogSearch: string) => void
}
```

- [ ] **Step 2: Thêm `useTranslation` vào `HighlightCard`, xoá `t` khỏi props destructure**

Tìm đầu hàm `HighlightCard`:

```tsx
// Trước:
const HighlightCard = React.memo(function HighlightCard({
  item,
  extendedIndex,
  scrollX,
  cardWidth,
  cardHeight,
  step,
  t,
  onPress,
}: HighlightCardProps) {
  const centeredAt = extendedIndex * step

// Sau:
const HighlightCard = React.memo(function HighlightCard({
  item,
  extendedIndex,
  scrollX,
  cardWidth,
  cardHeight,
  step,
  onPress,
}: HighlightCardProps) {
  const { t } = useTranslation('home')
  const centeredAt = extendedIndex * step
```

- [ ] **Step 3: Xoá `t` khỏi `renderItem` props và dep array**

Tìm `renderItem` useCallback:

```tsx
// Trước:
const renderItem = useCallback(
  ({ item, index }: { item: HighlightMenuItem; index: number }) => (
    <HighlightCard
      item={item}
      extendedIndex={index}
      scrollX={scrollX}
      cardWidth={cardWidth}
      cardHeight={cardHeight}
      step={step}
      t={t}
      onPress={handleItemPress}
    />
  ),
  [scrollX, cardWidth, cardHeight, step, t, handleItemPress],
)

// Sau:
const renderItem = useCallback(
  ({ item, index }: { item: HighlightMenuItem; index: number }) => (
    <HighlightCard
      item={item}
      extendedIndex={index}
      scrollX={scrollX}
      cardWidth={cardWidth}
      cardHeight={cardHeight}
      step={step}
      onPress={handleItemPress}
    />
  ),
  [scrollX, cardWidth, cardHeight, step, handleItemPress],
)
```

- [ ] **Step 4: Xoá `backgroundColor` ra khỏi `Dot` worklet**

Tìm `Dot` component và sửa:

```tsx
// Trước:
function Dot({
  targetOffset,
  scrollX,
  step,
  primaryColor,
}: {
  targetOffset: number
  scrollX: SharedValue<number>
  step: number
  primaryColor: string
}) {
  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const distance = Math.abs(scrollX.value - targetOffset)
    const active = interpolate(distance, [0, step], [1, 0], 'clamp')
    return {
      width: interpolate(active, [0, 1], [6, 18], 'clamp'),
      opacity: interpolate(active, [0, 1], [0.35, 1], 'clamp'),
      backgroundColor: primaryColor,
    }
  })

  return <Animated.View style={[dotStyle, { height: 6, borderRadius: 3 }]} />
}

// Sau:
function Dot({
  targetOffset,
  scrollX,
  step,
  primaryColor,
}: {
  targetOffset: number
  scrollX: SharedValue<number>
  step: number
  primaryColor: string
}) {
  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const distance = Math.abs(scrollX.value - targetOffset)
    const active = interpolate(distance, [0, step], [1, 0], 'clamp')
    return {
      width: interpolate(active, [0, 1], [6, 18], 'clamp'),
      opacity: interpolate(active, [0, 1], [0.35, 1], 'clamp'),
    }
  })

  return (
    <Animated.View
      style={[
        { height: 6, borderRadius: 3, backgroundColor: primaryColor },
        dotStyle,
      ]}
    />
  )
}
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): move t into HighlightCard, remove backgroundColor from Dot worklet"
```

---

### Task 6 (LOW): Hoist static styles + sửa `cachePolicy`

**Files:**

- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh:**

Mỗi render của `HighlightCard` tạo 5+ fresh inline style objects (Pressable, Image, LinearGradient, 2 Text). Hoist lên module-level `const` để tránh allocation. Đồng thời `cachePolicy="memory"` trên `Image` không cần thiết cho bundled assets — `"memory-disk"` tốt hơn.

- [ ] **Step 1: Thêm `StyleSheet` vào RN import**

```tsx
// Trước:
import { Pressable, Text, View, useWindowDimensions } from 'react-native'

// Sau:
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
```

- [ ] **Step 2: Thêm static styles dạng StyleSheet trước `HighlightCard`**

Thêm đoạn này ngay trước `const HighlightCard = React.memo(...)`:

```tsx
const cardStyles = StyleSheet.create({
  pressable: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
})
```

- [ ] **Step 3: Thay inline styles trong `HighlightCard` JSX**

Tìm phần JSX của `HighlightCard` và thay các inline styles:

```tsx
// Trước:
<Pressable
  onPress={handlePress}
  style={{ flex: 1, borderRadius: 20, overflow: 'hidden' }}
>
  <Image
    source={item.image}
    style={{ width: '100%', height: '100%' }}
    contentFit="cover"
    cachePolicy="memory"
    accessibilityLabel={t(item.nameKey)}
  />

  <LinearGradient
    colors={['transparent', 'rgba(0,0,0,0.78)']}
    locations={[0.38, 1]}
    style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60%',
      justifyContent: 'flex-end',
      paddingBottom: 18,
      paddingHorizontal: 16,
    }}
  >
    <Text
      style={{
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
      }}
      numberOfLines={1}
    >
      {t(item.nameKey)}
    </Text>
    <Text
      style={{
        color: 'rgba(255,255,255,0.72)',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 5,
      }}
    >
      Khám phá →
    </Text>
  </LinearGradient>
</Pressable>

// Sau:
<Pressable onPress={handlePress} style={cardStyles.pressable}>
  <Image
    source={item.image}
    style={cardStyles.image}
    contentFit="cover"
    cachePolicy="memory-disk"
    accessibilityLabel={t(item.nameKey)}
  />

  <LinearGradient
    colors={['transparent', 'rgba(0,0,0,0.78)']}
    locations={[0.38, 1]}
    style={cardStyles.gradientOverlay}
  >
    <Text style={cardStyles.title} numberOfLines={1}>
      {t(item.nameKey)}
    </Text>
    <Text style={cardStyles.subtitle}>Khám phá →</Text>
  </LinearGradient>
</Pressable>
```

- [ ] **Step 4: Thay inline `dotRow` style trong `HighlightMenuCarousel` JSX**

Tìm dot container `View` trong return JSX:

```tsx
// Trước:
<View
  style={{
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  }}
>

// Sau:
<View style={cardStyles.dotRow}>
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Verify tests**

```bash
npm test
```

Expected: 69 passed, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): hoist static styles to StyleSheet, fix cachePolicy to memory-disk"
```

---

## Self-Review

**Spec coverage:**

- ✅ CRITICAL 1: `useCatalog` → `prefetchQuery` + `getQueryData` lazy (Task 1)
- ✅ CRITICAL 2: `setMenuFilter` → `scheduleTransitionTask` + push-first (Task 1)
- ✅ HIGH 1: `estimatedItemSize={step}` (Task 2)
- ✅ HIGH 2: `keyExtractor` dùng `item.id` (Task 2)
- ✅ HIGH 3: `scrollEventThrottle={1}` (Task 2)
- ✅ HIGH 4: Xoá `scrollX.value` JS write race (Task 3)
- ✅ MED 1: `useMemo` card dimensions (Task 4)
- ✅ MED 2: `useMemo` highlightMenus (Task 4)
- ✅ MED 3: `t` vào `HighlightCard` (Task 5)
- ✅ MED 4: `backgroundColor` ra khỏi `Dot` worklet (Task 5)
- ✅ LOW 1: Hoist static styles (Task 6)
- ✅ LOW 2: `cachePolicy="memory-disk"` (Task 6)

**Placeholder scan:** Không có TBD/TODO. Tất cả steps có code đầy đủ.

**Type consistency:**

- `queryClient.getQueryData<IApiResponse<ICatalog[]>>([QUERYKEY.catalog])` — type nhất quán với `getCatalog(): Promise<IApiResponse<ICatalog[]>>` và queryKey `[QUERYKEY.catalog]` trong `useCatalog`
- `useSetMenuFilter()` trả về cùng type với `useMenuFilterStore((s) => s.setMenuFilter)`
- `HighlightCardProps` sau khi xoá `t`: không còn prop nào dùng `t`, `HighlightCard` tự lấy từ `useTranslation('home')`
- `cardStyles` dùng `StyleSheet.create` — TypeScript sẽ infer đúng `ViewStyle`/`TextStyle`/`ImageStyle`
