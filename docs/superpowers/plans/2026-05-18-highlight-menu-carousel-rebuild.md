# Highlight Menu Carousel Rebuild with react-native-reanimated-carousel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `HighlightMenuCarousel` in `components/home/highlight-menu.tsx` using `react-native-reanimated-carousel` to eliminate the 1-frame lag / item-2 delay caused by the current `Animated.ScrollView` + `scrollTo` teleport architecture.

**Architecture:** Replace the extended-data infinite-loop pattern (clone-last + items + clone-first + `scrollTo` boundary teleport) with `react-native-reanimated-carousel` which handles infinite loop internally via PanGesture + Reanimated — no teleport, no frame lag. `customAnimation` runs entirely on the UI thread and positions each absolutely-placed item with `translateX` plus focus-card effects (scale, opacity, translateY). `onProgressChange` passes a `SharedValue<number>` directly that the library drives, used for dot indicators.

**Tech Stack:** `react-native-reanimated-carousel` ^4.0.3 (already installed), React Native Reanimated 4.1.6 (`useAnimatedStyle`, `useSharedValue`, `interpolate`), Expo Router.

---

## File Map

| File                                 | Action | Trách nhiệm                    |
| ------------------------------------ | ------ | ------------------------------ |
| `components/home/highlight-menu.tsx` | Modify | Single file — all changes here |

---

## Context — Architecture của react-native-reanimated-carousel v4

Trước khi implement, cần hiểu cách thư viện hoạt động:

1. **`width` prop**: Khoảng cách giữa tâm 2 item liên tiếp (≡ `step = cardWidth + CARD_GAP`). Không phải width của container.
2. **`style` prop**: Áp dụng lên container View — nên set `width: screenWidth` để fill màn hình.
3. **`customAnimation(value, index) => ViewStyle`**: Hàm worklet (chạy UI thread) được gọi trong `useAnimatedStyle`. `value = x.value / size` là khoảng cách normalized của item so với vị trí centered:
   - `value = 0` → item đang centered
   - `value = 1` → item đang ở 1 bước sang phải của trung tâm
   - `value = -1` → item đang ở 1 bước sang trái
4. **Items là `position: absolute`** — `customAnimation` **BẮT BUỘC phải return `translateX`** để định vị item. Nếu không có `translateX`, tất cả items chồng lên nhau tại vị trí 0.
5. **`translateX` formula**: Khi `value = 0` (centered), item wrapper cần ở `sideInset = (screenWidth - step) / 2` từ trái màn hình. Khi `value = k`, offset thêm `k * step`. Vậy: `translateX = sideInset + value * step`.
6. **`onProgressChange={sharedValue}`**: Library tự động update `sharedValue.value = absoluteProgress` (index dạng float liên tục, vd: 0.0, 0.5, 1.0, 1.5...).
7. **`height` prop**: Height của item wrapper. Set bằng `cardHeight + 12` để có chỗ cho `translateY: 12` animation của inactive items.
8. **`loop={count > 1}`**: Chỉ bật loop khi có >1 item.
9. **`pagingEnabled`**: Mỗi swipe advance 1 item.

---

## Task 1: Rebuild HighlightMenuCarousel

**Files:**

- Modify: `components/home/highlight-menu.tsx`

### Mô tả thay đổi

Thay thế toàn bộ nội dung file `components/home/highlight-menu.tsx` bằng phiên bản mới sau. Đọc file hiện tại trước để verify, sau đó write file mới.

- [ ] **Step 1: Đọc file hiện tại để verify state**

```bash
cat -n components/home/highlight-menu.tsx
```

Expected: File hiện tại dùng `Animated.ScrollView` với extended data (clone-last, items, clone-first), `useAnimatedRef`, `scrollTo`, `useAnimatedScrollHandler`.

- [ ] **Step 2: Viết file mới**

Thay thế toàn bộ `components/home/highlight-menu.tsx` bằng nội dung sau:

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageSourcePropType, ViewStyle } from 'react-native'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import Carousel from 'react-native-reanimated-carousel'

import { getCatalog } from '@/api'
import { Images } from '@/assets/images'
import { QUERYKEY } from '@/constants'
import type { IApiResponse, ICatalog } from '@/types'
import { useSetMenuFilter } from '@/stores/selectors/menu-filter.selectors'

interface HighlightMenuItem {
  id: number
  image: ImageSourcePropType
  nameKey: string
  /** Keyword khớp với tên catalog từ API (không phân biệt hoa/thường) */
  catalogSearch: string
}

const DEFAULT_HIGHLIGHT_MENUS: HighlightMenuItem[] = [
  {
    id: 1,
    image: Images.Highlight.Menu2,
    nameKey: 'highlightMenu.coffee',
    catalogSearch: 'cà phê',
  },
  {
    id: 2,
    image: Images.Highlight.Menu3,
    nameKey: 'highlightMenu.tea',
    catalogSearch: 'trà',
  },
  {
    id: 3,
    image: Images.Highlight.Menu4,
    nameKey: 'highlightMenu.smoothie',
    catalogSearch: 'đá xay',
  },
  {
    id: 4,
    image: Images.Highlight.Menu5,
    nameKey: 'highlightMenu.food',
    catalogSearch: 'món ăn',
  },
]

const CARD_GAP = 12

// ─── Dot ─────────────────────────────────────────────────────────────────────

function Dot({
  index,
  count,
  absoluteProgress,
  primaryColor,
}: {
  index: number
  count: number
  absoluteProgress: SharedValue<number>
  primaryColor: string
}) {
  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const raw = Math.abs(absoluteProgress.value - index)
    // wrap-around: khoảng cách ngắn nhất giữa progress và dot index trên vòng tròn
    const dist = Math.min(raw, count - raw)
    const active = interpolate(dist, [0, 1], [1, 0], 'clamp')
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

// ─── Card ─────────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  pressable: { flex: 1 },
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

interface HighlightCardProps {
  item: HighlightMenuItem
  cardWidth: number
  cardHeight: number
  onPress: (catalogSearch: string) => void
}

const HighlightCard = React.memo(function HighlightCard({
  item,
  cardWidth,
  cardHeight,
  onPress,
}: HighlightCardProps) {
  const { t } = useTranslation('home')
  const handlePress = useCallback(
    () => onPress(item.catalogSearch),
    [onPress, item.catalogSearch],
  )

  return (
    <View
      style={{
        width: cardWidth,
        height: cardHeight,
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
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
    </View>
  )
})

// ─── Carousel ─────────────────────────────────────────────────────────────────

interface HighlightMenuCarouselProps {
  items?: HighlightMenuItem[]
  primaryColor?: string
}

const HighlightMenuCarousel = React.memo(function HighlightMenuCarousel({
  items,
  primaryColor = '#000',
}: HighlightMenuCarouselProps) {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const highlightMenus = useMemo(
    () => items ?? DEFAULT_HIGHLIGHT_MENUS,
    [items],
  )
  const count = highlightMenus.length

  const queryClient = useQueryClient()
  const setMenuFilter = useSetMenuFilter()

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: [QUERYKEY.catalog],
      queryFn: () => getCatalog(),
    })
  }, [queryClient])

  const { cardWidth, cardHeight, sideInset, step } = useMemo(() => {
    const w = screenWidth * 0.72
    const h = w * 1.28
    const s = w + CARD_GAP
    return {
      cardWidth: w,
      cardHeight: h,
      // sideInset: khoảng cách từ cạnh trái container đến cạnh trái item centered.
      // = (screenWidth - step) / 2, đảm bảo tâm item centered = tâm màn hình.
      sideInset: (screenWidth - s) / 2,
      step: s,
    }
  }, [screenWidth])

  // absoluteProgress được library tự động update: 0.0 khi item 0 centered, 1.0 khi item 1, v.v.
  const absoluteProgress = useSharedValue(0)

  // customAnimation: chạy trên UI thread, return ViewStyle cho mỗi item.
  // value = x.value / step (normalized distance từ vị trí centered).
  // Bắt buộc có translateX vì items là position:absolute.
  const customAnimation = useCallback(
    (value: number): ViewStyle => {
      'worklet'
      const p = Math.max(0, 1 - Math.abs(value))
      return {
        opacity: 0.55 + 0.45 * p,
        transform: [
          { translateX: sideInset + value * step },
          { scale: 0.86 + 0.14 * p },
          { translateY: 12 * (1 - p) },
        ],
      }
    },
    [sideInset, step],
  )

  const handleItemPress = useCallback(
    (catalogSearch: string) => {
      router.push('/(tabs)/menu' as never)
      queryClient
        .ensureQueryData<IApiResponse<ICatalog[]>>({
          queryKey: [QUERYKEY.catalog],
          queryFn: () => getCatalog(),
        })
        .then((res) => {
          const needle = catalogSearch.toLowerCase()
          const matched = res.result?.find((c) =>
            c.name.toLowerCase().includes(needle),
          )
          setMenuFilter((prev) => ({
            ...prev,
            catalog: matched?.slug,
          }))
        })
        .catch(() => {
          // catalog fetch failed — menu hiển thị không filter
        })
    },
    [queryClient, setMenuFilter, router],
  )

  const renderItem = useCallback(
    ({ item }: { item: HighlightMenuItem }) => (
      <View style={{ flex: 1, alignItems: 'center' }}>
        <HighlightCard
          item={item}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          onPress={handleItemPress}
        />
      </View>
    ),
    [cardWidth, cardHeight, handleItemPress],
  )

  return (
    <View>
      <View style={{ height: cardHeight + 12 }}>
        <Carousel
          width={step}
          height={cardHeight + 12}
          style={{ width: screenWidth }}
          data={highlightMenus}
          loop={count > 1}
          pagingEnabled
          snapEnabled
          onProgressChange={absoluteProgress}
          customAnimation={customAnimation}
          renderItem={renderItem}
        />
      </View>
      <View style={cardStyles.dotRow}>
        {highlightMenus.map((item, index) => (
          <Dot
            key={item.id}
            index={index}
            count={count}
            absoluteProgress={absoluteProgress}
            primaryColor={primaryColor}
          />
        ))}
      </View>
    </View>
  )
})

export default HighlightMenuCarousel
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors. Nếu có lỗi liên quan `customAnimation` return type, xem phần fix bên dưới.

**Nếu TypeScript báo lỗi `transform` type không tương thích:**
Thay dòng return trong `customAnimation`:

```tsx
return {
  opacity: 0.55 + 0.45 * p,
  transform: [
    { translateX: sideInset + value * step },
    { scale: 0.86 + 0.14 * p },
    { translateY: 12 * (1 - p) },
  ] as ViewStyle['transform'],
}
```

**Nếu TypeScript báo lỗi `onProgressChange` type (SharedValue không khớp):**

```tsx
onProgressChange={absoluteProgress as Parameters<NonNullable<React.ComponentProps<typeof Carousel>['onProgressChange']>>[0] as never}
```

Hoặc đơn giản hơn, dùng callback form:

```tsx
// Thay onProgressChange={absoluteProgress} bằng:
onProgressChange={(_offset, abs) => {
  absoluteProgress.value = abs
}}
```

Note: callback form chạy trên JS thread nên dot animation sẽ kém smooth hơn SharedValue form. Prefer SharedValue form nếu TypeScript cho phép.

**Nếu TypeScript báo lỗi `renderItem` type:**
Thêm import type:

```tsx
import Carousel, {
  type CarouselRenderItem,
} from 'react-native-reanimated-carousel'
```

Rồi type `renderItem`:

```tsx
const renderItem: CarouselRenderItem<HighlightMenuItem> = useCallback(
  ({ item }) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <HighlightCard
        item={item}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        onPress={handleItemPress}
      />
    </View>
  ),
  [cardWidth, cardHeight, handleItemPress],
)
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: tất cả tests pass (không có test trực tiếp cho component này, nhưng snapshot tests hoặc unit tests khác không được break).

- [ ] **Step 5: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "refactor(home): rebuild highlight carousel with reanimated-carousel, no teleport"
```

---

## Self-Review

**Spec coverage:**

- ✅ Infinite loop không flash: `loop={true}` trong reanimated-carousel — không teleport, không frame lag
- ✅ Item-2 không bị delayed sau loop: Không còn extended-data + scrollTo — library xử lý internally với PanGesture
- ✅ Focus-card effect (scale 0.86→1, opacity 0.55→1, translateY 12→0): `customAnimation` với `p = Math.max(0, 1 - Math.abs(value))`
- ✅ translateX để định vị absolute items: `translateX = sideInset + value * step`
- ✅ Dot indicators smooth tại boundary: wrap-around distance `Math.min(raw, count - raw)` với SharedValue
- ✅ Press → navigate menu + filter catalog: `handleItemPress` không thay đổi
- ✅ Prefetch catalog on mount: `useEffect` với `queryClient.prefetchQuery` giữ nguyên
- ✅ Card dimensions: `cardWidth = screenWidth * 0.72`, `cardHeight = w * 1.28` giữ nguyên
- ✅ Extra height cho translateY animation: container và Carousel đều `cardHeight + 12`

**Placeholder scan:** Không có TBD/TODO. Tất cả code đầy đủ.

**Type consistency:**

- `HighlightCard` props: `item, cardWidth, cardHeight, onPress` — nhất quán giữa definition và usage ✓
- `Dot` props: `index, count, absoluteProgress, primaryColor` — nhất quán ✓
- `customAnimation` nhận `value: number`, return `ViewStyle` — khớp với `TCarouselProps.customAnimation` signature ✓
- `absoluteProgress: SharedValue<number>` — dùng trong `Dot` và `onProgressChange` ✓
