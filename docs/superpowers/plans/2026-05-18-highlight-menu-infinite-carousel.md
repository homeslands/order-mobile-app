# Highlight Menu Infinite Carousel Smoothness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho infinite loop carousel mượt mà hoàn toàn — không flash, không miss teleport khi chain fling, không frame mismatch giữa scrollX và native scroll position.

**Architecture:** 2 tasks độc lập trong `components/home/highlight-menu.tsx`. Task 1 là thay đổi kiến trúc lớn nhất: chuyển teleport detection từ JS-thread `onMomentumScrollEnd` callback sang UI-thread `onMomentumEnd` worklet (trong `useAnimatedScrollHandler`), sync `scrollX.value` trước khi gọi native scroll, bỏ `Animated.createAnimatedComponent` wrapper không cần thiết (Reanimated 4.1 hỗ trợ pass handler trực tiếp), và dùng `initialScrollIndex` thay `useEffect` mount-jump. Task 2 tối ưu worklet của card với `useDerivedValue`.

**Tech Stack:** React Native Reanimated 4.1.6 (`useAnimatedScrollHandler` với `onMomentumEnd` worklet, `runOnJS`, `useDerivedValue`), `@shopify/flash-list` 2.0.2 (`initialScrollIndex`, `getItemType`).

---

## File Map

| File | Action | Trách nhiệm |
|------|--------|-------------|
| `components/home/highlight-menu.tsx` | Modify | Cả 2 tasks |

---

### Task 1 (CRITICAL): Chuyển teleport vào onMomentumEnd worklet + bỏ AnimatedFlashList

**Files:**
- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh — 3 vấn đề cần fix cùng lúc:**

1. **scrollX race**: `onMomentumScrollEnd` JS callback chạy SAU native scroll event → `scrollX.value` cập nhật muộn → 1–2 frame card dùng wrong scale/opacity sau teleport → flash.

2. **Chain fling miss**: khi user fling liên tiếp nhanh, momentum bị cancel trước khi "end" → `onMomentumScrollEnd` không fire → teleport không xảy ra → carousel kẹt ở clone.

3. **Mount frame gap**: `useEffect` + `requestAnimationFrame` scroll về item 1 xảy ra sau frame mount → frame 0 native ở offset 0 (clone-last) nhưng `scrollX` khởi tạo = `step` → brief mismatch.

**Fix:** Chuyển toàn bộ teleport logic vào `onMomentumEnd` worklet (UI thread, không miss), set `scrollX.value` trước khi `runOnJS(teleport)`. Dùng `initialScrollIndex={1}` thay useEffect.

- [ ] **Step 1: Cập nhật Reanimated imports — thêm `runOnJS`**

Tìm block import reanimated:
```tsx
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
```

Thay thành:
```tsx
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
```

- [ ] **Step 2: Xoá `AnimatedFlashList` constant**

Tìm và xoá 3 dòng này (khoảng line 224–226):
```tsx
const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList<HighlightMenuItem>,
)
```

- [ ] **Step 3: Thêm `teleport` callback và `getItemType` callback vào `HighlightMenuCarousel`**

Thêm 2 callback này ngay TRƯỚC khi khai báo `scrollX` (sau `listRef`):

```tsx
// Được gọi từ worklet qua runOnJS — không thể inline trong worklet.
const teleport = useCallback(
  (offset: number) => {
    listRef.current?.scrollToOffset({ offset, animated: false })
  },
  [],
)

const getItemType = useCallback(
  (_: HighlightMenuItem, index: number) => {
    if (index === 0) return 'clone-last'
    if (index === count + 1) return 'clone-first'
    return 'real'
  },
  [count],
)
```

- [ ] **Step 4: Rewrite `scrollHandler` với `onMomentumEnd` worklet**

Tìm `scrollHandler` hiện tại:
```tsx
const scrollHandler = useAnimatedScrollHandler((e) => {
  'worklet'
  scrollX.value = e.contentOffset.x
})
```

Thay thành (object form với 2 handlers):
```tsx
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (e) => {
    'worklet'
    scrollX.value = e.contentOffset.x
  },
  onMomentumEnd: (e) => {
    'worklet'
    if (count <= 1) return
    const x = e.contentOffset.x
    // Dùng epsilon 10% step để chống double-snap Android và floating point drift
    const EPS = step * 0.1
    if (Math.abs(x) < EPS) {
      // Clone-last (index 0) đang centered → teleport về real last item
      const t = count * step
      scrollX.value = t          // sync UI thread TRƯỚC để tránh frame mismatch
      runOnJS(teleport)(t)       // rồi mới gọi native scroll
    } else if (Math.abs(x - (count + 1) * step) < EPS) {
      // Clone-first (index count+1) đang centered → teleport về real first item
      const t = step
      scrollX.value = t
      runOnJS(teleport)(t)
    }
  },
})
```

- [ ] **Step 5: Xoá `handleScrollEnd` và `useEffect` mount-jump**

Xoá toàn bộ `handleScrollEnd` useCallback (dùng `onMomentumScrollEnd` — không còn cần):
```tsx
// XOÁ toàn bộ block này:
const handleScrollEnd = useCallback(
  (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (count <= 1) return
    const rawIndex = Math.round(e.nativeEvent.contentOffset.x / step)

    if (rawIndex === 0) {
      // Swiped past beginning → jump to real last item
      listRef.current?.scrollToOffset({ offset: count * step, animated: false })
    } else if (rawIndex === count + 1) {
      // Swiped past end → jump to real first item
      listRef.current?.scrollToOffset({ offset: step, animated: false })
    }
  },
  [count, step],
)
```

Xoá `useEffect` mount-jump:
```tsx
// XOÁ toàn bộ block này:
useEffect(() => {
  if (count <= 1) return
  requestAnimationFrame(() => {
    listRef.current?.scrollToOffset({ offset: step, animated: false })
  })
  // run once; step is stable for a given screen width
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [count])
```

- [ ] **Step 6: Cập nhật JSX — thay `AnimatedFlashList` bằng `FlashList`, thêm `initialScrollIndex` và `getItemType`, sửa `scrollEventThrottle`, bỏ `onMomentumScrollEnd`**

Tìm toàn bộ `<AnimatedFlashList ... />` trong JSX:
```tsx
<AnimatedFlashList
  ref={listRef as React.Ref<FlashListRef<HighlightMenuItem>>}
  data={extendedMenus}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  // @ts-expect-error estimatedItemSize is supported at runtime but not typed in Animated.createAnimatedComponent
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

Thay thành (plain `FlashList` — Reanimated 4 pass handler trực tiếp, không cần wrapper):
```tsx
<FlashList
  ref={listRef}
  data={extendedMenus}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  getItemType={getItemType}
  estimatedItemSize={step}
  initialScrollIndex={count > 1 ? 1 : 0}
  horizontal
  showsHorizontalScrollIndicator={false}
  onScroll={scrollHandler as never}
  scrollEventThrottle={16}
  snapToInterval={step}
  decelerationRate="fast"
  contentContainerStyle={listContentStyle}
/>
```

Lưu ý:
- `onScroll={scrollHandler as never}` — cast vì Reanimated 4 scroll handler type không khớp với FlashList prop type, nhưng runtime hoạt động đúng.
- Không còn `onMomentumScrollEnd` — teleport đã handle trong worklet.
- `@ts-expect-error` không cần nữa — `estimatedItemSize` là prop chính thức của `FlashList`.
- `scrollEventThrottle={16}` — đủ cho 60fps, giảm event load so với `1`.
- `initialScrollIndex={count > 1 ? 1 : 0}` — FlashList mount tại item 1 (real first) từ frame đầu. FlashList tính offset = `estimatedItemSize * index = step * 1 = step`, đúng với centering logic hiện tại.

- [ ] **Step 7: Xoá `Animated` wrapper nếu không còn dùng**

Kiểm tra xem `Animated` từ `react-native-reanimated` còn được dùng ở đâu không (ngoài `AnimatedFlashList` đã xoá):
```bash
grep -n "Animated\." components/home/highlight-menu.tsx
```

Nếu `Animated.View` vẫn dùng trong `HighlightCard` và `Dot` → giữ nguyên `import Animated`. Nếu không còn dùng gì → xoá. (Thường vẫn còn `Animated.View`.)

- [ ] **Step 8: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "fix(home): teleport via onMomentumEnd worklet, remove AnimatedFlashList wrapper"
```

---

### Task 2 (HIGH): Tối ưu card animation worklet với `useDerivedValue`

**Files:**
- Modify: `components/home/highlight-menu.tsx`

**Bối cảnh:**

`HighlightCard.animStyle` worklet hiện gọi 3 lần `interpolate()` mỗi scroll frame (scale, opacity, translateY). Mỗi `interpolate` call có overhead trên Hermes (tìm range, tính hệ số). Với 6 cards (4 real + 2 clone), đó là 18 interpolate calls mỗi frame. Thay bằng 1 lần tính `progress` (0→1) qua `useDerivedValue`, rồi dùng arithmetic đơn giản trong `useAnimatedStyle`.

**Math xác minh:**
- `progress = 1 - |scrollX - centeredAt| / step` ∈ [0, 1]
- `opacity = 0.55 + 0.45 * p` → p=1: 1.0 ✓, p=0: 0.55 ✓
- `scale = 0.86 + 0.14 * p` → p=1: 1.0 ✓, p=0: 0.86 ✓
- `translateY = 12 * (1 - p)` → p=1: 0 ✓, p=0: 12 ✓

- [ ] **Step 1: Thêm `useDerivedValue` vào Reanimated imports**

Tìm block reanimated imports (đã có `runOnJS` từ Task 1):
```tsx
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
```

Thay thành:
```tsx
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
```

- [ ] **Step 2: Thay thế `animStyle` worklet trong `HighlightCard`**

Tìm trong `HighlightCard`:
```tsx
const animStyle = useAnimatedStyle(() => {
  'worklet'
  const inputRange = [centeredAt - step, centeredAt, centeredAt + step]
  const scale = interpolate(
    scrollX.value,
    inputRange,
    [0.86, 1, 0.86],
    'clamp',
  )
  const opacity = interpolate(
    scrollX.value,
    inputRange,
    [0.55, 1, 0.55],
    'clamp',
  )
  const translateY = interpolate(
    scrollX.value,
    inputRange,
    [12, 0, 12],
    'clamp',
  )
  return { transform: [{ scale }, { translateY }], opacity }
})
```

Thay thành:
```tsx
const progress = useDerivedValue(() => {
  'worklet'
  return Math.max(0, 1 - Math.abs(scrollX.value - centeredAt) / step)
})

const animStyle = useAnimatedStyle(() => {
  'worklet'
  const p = progress.value
  return {
    opacity: 0.55 + 0.45 * p,
    transform: [
      { scale: 0.86 + 0.14 * p },
      { translateY: 12 * (1 - p) },
    ],
  }
})
```

Lưu ý: `interpolate` import vẫn còn trong file (dùng bởi `Dot` component) — KHÔNG xoá.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Verify tests**

```bash
npm test
```

Expected: 69 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): replace 3x interpolate in card worklet with useDerivedValue progress"
```

---

## Self-Review

**Spec coverage:**
- ✅ CRITICAL 1 (scrollX race): `scrollX.value = t` trước `runOnJS(teleport)(t)` trong worklet (Task 1 Step 4)
- ✅ CRITICAL 2 (chain fling miss): `onMomentumEnd` worklet thay `onMomentumScrollEnd` JS callback (Task 1 Step 4)
- ✅ CRITICAL 3 (AnimatedFlashList risk): Dùng plain `FlashList`, không `createAnimatedComponent` (Task 1 Step 2 + 6)
- ✅ HIGH 1 (mount frame gap): `initialScrollIndex={1}` thay `useEffect` + rAF (Task 1 Step 5 + 6)
- ✅ HIGH 2 (getItemType pool): `getItemType` callback phân biệt clone vs real (Task 1 Step 3 + 6)
- ✅ HIGH 3 (worklet optimize): `useDerivedValue` progress thay 3x `interpolate` (Task 2)
- ✅ MEDIUM (scrollEventThrottle): `16` thay `1` (Task 1 Step 6)
- ✅ MEDIUM (epsilon check): `EPS = step * 0.1` trong worklet (Task 1 Step 4)

**Placeholder scan:** Không có TBD/TODO. Tất cả code đầy đủ.

**Type consistency:**
- `teleport: (offset: number) => void` — dùng trong `runOnJS(teleport)(t)` ✓
- `getItemType: (_: HighlightMenuItem, index: number) => string` — match FlashList `getItemType` prop ✓
- `progress: SharedValue<number>` (return của `useDerivedValue`) — `.value` dùng trong `useAnimatedStyle` ✓
- `onScroll={scrollHandler as never}` — pragmatic cast, runtime đúng ✓
- `Math.max(0, 1 - ...)` clamp — tương đương `Extrapolation.CLAMP` của interpolate ✓
