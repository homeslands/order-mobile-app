import { useQueryClient } from '@tanstack/react-query'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageSourcePropType } from 'react-native'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'

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

// ─── Dot — targetOffset = scrollX value when this dot is "active" ─────────────

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
      style={[{ height: 6, borderRadius: 3, backgroundColor: primaryColor }, dotStyle]}
    />
  )
}

// ─── Card — extended index drives centeredAt ──────────────────────────────────

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

interface HighlightCardProps {
  item: HighlightMenuItem
  extendedIndex: number
  scrollX: SharedValue<number>
  cardWidth: number
  cardHeight: number
  step: number
  onPress: (catalogSearch: string) => void
}

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

  const handlePress = useCallback(
    () => onPress(item.catalogSearch),
    [onPress, item.catalogSearch],
  )

  return (
    <Animated.View
      style={[
        {
          width: cardWidth,
          height: cardHeight,
          // Gap được chia đều 2 bên mỗi card — tránh conditional margin theo
          // index vì FlashList recycle cells, nếu layout phụ thuộc index đầu
          // tiên sẽ gây layout flicker lúc recycle.
          marginHorizontal: CARD_GAP / 2,
          borderRadius: 20,
        },
        animStyle,
      ]}
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
    </Animated.View>
  )
})

// ─── Carousel ─────────────────────────────────────────────────────────────────

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList<HighlightMenuItem>,
)

interface HighlightMenuCarouselProps {
  items?: HighlightMenuItem[]
  primaryColor?: string
}

/**
 * Focus-card carousel với infinite scroll.
 * Extended data: [cloneOfLast, ...items, cloneOfFirst]
 * Teleport on boundaries so the user never sees an end.
 */
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
    return {
      cardWidth: w,
      cardHeight: h,
      // sideInset bù CARD_GAP/2 vì mỗi card có marginHorizontal = CARD_GAP/2.
      // Đảm bảo card trung tâm luôn căn đúng giữa màn hình.
      sideInset: (screenWidth - w) / 2 - CARD_GAP / 2,
      step: w + CARD_GAP,
    }
  }, [screenWidth])

  /**
   * Infinite data: [lastClone, item0, item1, ..., itemN-1, firstClone]
   * Real items live at extended indices 1..count.
   * At scroll offset k*step, item at extended index k is centered.
   */
  const extendedMenus = useMemo(() => {
    if (count <= 1) return highlightMenus
    return [highlightMenus[count - 1], ...highlightMenus, highlightMenus[0]]
  }, [highlightMenus, count])

  // Ref for imperative scrollToOffset during teleport.
  const listRef = useRef<FlashListRef<HighlightMenuItem>>(null)

  // Called via runOnJS from worklet — must be a stable JS function.
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

  // scrollX tracks raw FlatList content offset.
  // Real first item lives at offset 1*step, so init there.
  const scrollX = useSharedValue(count > 1 ? step : 0)

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet'
      scrollX.value = e.contentOffset.x
    },
    onMomentumEnd: (e) => {
      'worklet'
      if (count <= 1) return
      const x = e.contentOffset.x
      // Epsilon 10% of step guards against double-snap on Android and float drift
      const EPS = step * 0.1
      if (Math.abs(x) < EPS) {
        const t = count * step
        scrollX.value = t // sync UI thread first to avoid frame mismatch
        runOnJS(teleport)(t)
      } else if (Math.abs(x - (count + 1) * step) < EPS) {
        const t = step
        scrollX.value = t
        runOnJS(teleport)(t)
      }
    },
  })

  const handleItemPress = useCallback(
    (catalogSearch: string) => {
      router.push('/(tabs)/menu' as never)
      // ensureQueryData: resolve sync từ cache (warm) hoặc await network (cold).
      // .then() là microtask khi warm → setMenuFilter chạy trước menu screen fetch đầu.
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

  // Use extended index as key — avoids id collision between clone and original
  const keyExtractor = useCallback(
    (item: HighlightMenuItem, index: number) => {
      if (index === 0) return `hl-clone-last-${item.id}`
      if (index === count + 1) return `hl-clone-first-${item.id}`
      return `hl-${item.id}`
    },
    [count],
  )

  const listContentStyle = useMemo(
    () => ({ paddingHorizontal: sideInset, alignItems: 'center' as const }),
    [sideInset],
  )

  return (
    <View>
      {/* FlashList horizontal cần parent có bounded height để layout đúng. */}
      <View style={{ height: cardHeight + 12 }}>
        <AnimatedFlashList
          ref={listRef as React.Ref<FlashListRef<HighlightMenuItem>>}
          data={extendedMenus}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          // @ts-expect-error estimatedItemSize is a required FlashList prop at runtime but missing from v2 type declarations
          estimatedItemSize={step}
          initialScrollIndex={count > 1 ? 1 : 0}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          snapToInterval={step}
          decelerationRate="fast"
          contentContainerStyle={listContentStyle}
        />
      </View>

      {/* Dot indicators — indexed against real items only.
          Each dot's targetOffset = scroll position where that real item is centered.
          Real item i lives at extended index i+1 → offset (i+1)*step. */}
      <View style={cardStyles.dotRow}>
        {highlightMenus.map((item, index) => (
          <Dot
            key={item.id}
            targetOffset={(index + 1) * step}
            scrollX={scrollX}
            step={step}
            primaryColor={primaryColor}
          />
        ))}
      </View>
    </View>
  )
})

export default HighlightMenuCarousel
