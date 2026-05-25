# Highlight Menu Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ các re-render không cần thiết và race condition trong `HighlightMenuCarousel` để carousel chỉ re-render khi data thực sự thay đổi.

**Architecture:** Tất cả thay đổi nằm trong một file duy nhất `components/home/highlight-menu.tsx`. Không tạo file mới, không thay đổi interface public. Các fix độc lập nhau — thực hiện tuần tự từ tác động lớn nhất đến nhỏ nhất.

**Tech Stack:** React Native, React Query (`useQueryClient`/`getQueryData`), Reanimated 4.1 (`SharedValue`), `@shopify/flash-list`, Zustand selectors.

---

## File Map

| File                                 | Action | Trách nhiệm    |
| ------------------------------------ | ------ | -------------- |
| `components/home/highlight-menu.tsx` | Modify | Tất cả 5 fixes |

---

### Task 1: Bỏ `useCatalog()` subscription — đọc catalog lazy khi press

**Files:**

- Modify: `components/home/highlight-menu.tsx:18–19, 233–234, 297–309`

Hiện tại `useCatalog()` khiến toàn bộ carousel re-render mỗi lần React Query refetch catalog (mỗi 30s). Fix: đọc từ cache `queryClient.getQueryData` ngay tại thời điểm user nhấn, không subscribe reactive.

Đồng thời đổi `useMenuFilterStore((s) => s.setMenuFilter)` → `useSetMenuFilter()` từ selectors (convention project), và wrap `setMenuFilter` trong `scheduleTransitionTask` + đổi thứ tự: `router.push` trước, update store sau (tránh AsyncStorage block JS thread khi animation đang chạy).

- [ ] **Step 1: Cập nhật imports**

Thay thế toàn bộ block import hiện tại ở đầu file:

```tsx
// Xoá:
import { useCatalog } from '@/hooks'
import { useMenuFilterStore } from '@/stores'

// Thêm:
import { useQueryClient } from '@tanstack/react-query'
import { QUERYKEY } from '@/constants'
import type { IApiResponse } from '@/types'
import type { ICatalog } from '@/types'
import { useSetMenuFilter } from '@/stores/selectors/menu-filter.selectors'
import { scheduleTransitionTask } from '@/lib/navigation'
```

File sau khi sửa imports (chỉ phần imports liên quan — giữ nguyên tất cả import khác):

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

import { Images } from '@/assets/images'
import { QUERYKEY } from '@/constants'
import type { IApiResponse, ICatalog } from '@/types'
import { useSetMenuFilter } from '@/stores/selectors/menu-filter.selectors'
import { scheduleTransitionTask } from '@/lib/navigation'
```

- [ ] **Step 2: Thay `useCatalog()` và `useMenuFilterStore` bên trong `HighlightMenuCarousel`**

Xoá 2 dòng cũ (line 233–234):

```tsx
// Xoá:
const { data: catalogResponse } = useCatalog()
const setMenuFilter = useMenuFilterStore((s) => s.setMenuFilter)
```

Thêm vào thay thế:

```tsx
const queryClient = useQueryClient()
const setMenuFilter = useSetMenuFilter()
```

- [ ] **Step 3: Cập nhật `handleItemPress`**

Thay toàn bộ `handleItemPress` (line 297–310):

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
    const cached = queryClient.getQueryData<IApiResponse<ICatalog[]>>(
      QUERYKEY.catalog,
    )
    const catalogs = cached?.result ?? []
    const matched = catalogs.find((c) =>
      c.name.toLowerCase().includes(catalogSearch.toLowerCase()),
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

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors. Nếu có lỗi type trên `QUERYKEY.catalog` (vì nó là `string[]`), dùng `[...QUERYKEY.catalog]` hoặc cast `as unknown as QueryKey`.

- [ ] **Step 5: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): lazy-read catalog on press instead of reactive subscription"
```

---

### Task 2: Thêm `estimatedItemSize` vào AnimatedFlashList

**Files:**

- Modify: `components/home/highlight-menu.tsx:343–356`

FlashList **bắt buộc** phải có `estimatedItemSize` để recycling hoạt động đúng. Với horizontal list, giá trị này là chiều rộng của một item = `step` (`cardWidth + CARD_GAP`).

- [ ] **Step 1: Thêm `estimatedItemSize` vào `AnimatedFlashList`**

Tìm `<AnimatedFlashList` (line ~343) và thêm prop `estimatedItemSize`:

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
  scrollEventThrottle={16}
  snapToInterval={step}
  decelerationRate="fast"
  contentContainerStyle={listContentStyle}
  onMomentumScrollEnd={handleScrollEnd}
/>
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): add estimatedItemSize to highlight menu FlashList"
```

---

### Task 3: Xoá race condition `scrollX.value` write từ JS thread

**Files:**

- Modify: `components/home/highlight-menu.tsx:277–295`

Sau khi `scrollToOffset({ animated: false })` được gọi, OS sẽ tự fire scroll event → worklet `scrollHandler` cập nhật `scrollX.value` đúng. Việc ghi `scrollX.value = target` từ JS thread tạo race: hai write đến cùng `SharedValue` trong cùng frame, có thể gây animation jump ở biên carousel. Bỏ 2 dòng JS write là đủ.

- [ ] **Step 1: Xoá `scrollX.value = target` trong `handleScrollEnd`**

Tìm `handleScrollEnd` (line ~277) và xoá 2 dòng gán `scrollX.value`:

```tsx
// Trước:
const handleScrollEnd = useCallback(
  (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (count <= 1) return
    const rawIndex = Math.round(e.nativeEvent.contentOffset.x / step)

    if (rawIndex === 0) {
      const target = count * step
      listRef.current?.scrollToOffset({ offset: target, animated: false })
      scrollX.value = target // ← xoá dòng này
    } else if (rawIndex === count + 1) {
      const target = step
      listRef.current?.scrollToOffset({ offset: target, animated: false })
      scrollX.value = target // ← xoá dòng này
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
      const target = count * step
      listRef.current?.scrollToOffset({ offset: target, animated: false })
    } else if (rawIndex === count + 1) {
      const target = step
      listRef.current?.scrollToOffset({ offset: target, animated: false })
    }
  },
  [count, step],
)
```

Lưu ý: `scrollX` cũng đã được xoá khỏi dep array vì không còn dùng bên trong.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "fix(home): remove JS-thread scrollX write race with worklet in handleScrollEnd"
```

---

### Task 4: Wrap card dimensions trong `useMemo`

**Files:**

- Modify: `components/home/highlight-menu.tsx:236–241`

`cardWidth`, `cardHeight`, `sideInset`, `step` hiện được tính inline mỗi render. Vì chúng là primitive numbers, `useCallback` deps so sánh bằng value nên thực tế không gây vấn đề khi `screenWidth` không đổi. Tuy nhiên wrap `useMemo` để ổn định deps, rõ ràng hơn về intent, và phòng khi có rotation/tablet support sau này.

- [ ] **Step 1: Wrap dimensions vào `useMemo`**

Thay thế 4 dòng khai báo riêng lẻ (line 236–241):

```tsx
// Trước:
const cardWidth = screenWidth * 0.72
const cardHeight = cardWidth * 1.28
// sideInset bù CARD_GAP/2 vì mỗi card có marginHorizontal = CARD_GAP/2.
// Đảm bảo card trung tâm luôn căn đúng giữa màn hình.
const sideInset = (screenWidth - cardWidth) / 2 - CARD_GAP / 2
const step = cardWidth + CARD_GAP

// Sau:
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

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): memoize card dimensions derived from screenWidth"
```

---

### Task 5: Thêm cleanup cho `requestAnimationFrame` trong `useEffect`

**Files:**

- Modify: `components/home/highlight-menu.tsx:267–274`

`requestAnimationFrame` không được cancel khi component unmount. Nếu component unmount trước khi RAF chạy (ví dụ navigation rất nhanh), callback vẫn chạy và gọi `listRef.current?.scrollToOffset` — tuy `?.` null-safe nhưng vẫn là dangling call. Thêm cleanup để cancel.

Đồng thời thêm `step` vào dep array — nếu screenWidth thay đổi (rotation, tablet) thì vị trí scroll mount sẽ tính lại đúng.

- [ ] **Step 1: Thêm cleanup và `step` vào dep**

```tsx
// Trước:
useEffect(() => {
  if (count <= 1) return
  requestAnimationFrame(() => {
    listRef.current?.scrollToOffset({ offset: step, animated: false })
  })
  // run once; step is stable for a given screen width
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [count])

// Sau:
useEffect(() => {
  if (count <= 1) return
  const raf = requestAnimationFrame(() => {
    listRef.current?.scrollToOffset({ offset: step, animated: false })
  })
  return () => cancelAnimationFrame(raf)
}, [count, step])
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "fix(home): cancel requestAnimationFrame on carousel unmount"
```

---

## Self-Review

**Spec coverage:**

- ✅ Task 1: CRITICAL — bỏ `useCatalog()` subscription, lazy read, `scheduleTransitionTask`, selector convention
- ✅ Task 2: HIGH — `estimatedItemSize` FlashList
- ✅ Task 3: HIGH — race condition `scrollX.value`
- ✅ Task 4: HIGH — `useMemo` card dimensions
- ✅ Task 5: LOW — RAF cleanup + dep array

**Placeholder scan:** Không có TBD/TODO. Tất cả steps có code đầy đủ.

**Type consistency:** `IApiResponse<ICatalog[]>` dùng nhất quán với type từ `api/catalog.ts`. `QUERYKEY.catalog` là `string[]` — truyền trực tiếp vào `getQueryData` là đúng signature của React Query v5 (`QueryKey`). `useSetMenuFilter` trả về `setMenuFilter` cùng type với `useMenuFilterStore((s) => s.setMenuFilter)`.
