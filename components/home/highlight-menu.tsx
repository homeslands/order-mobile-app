import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageSourcePropType } from 'react-native'
import { FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'

import { Images } from '@/assets/images'
import { useCatalog } from '@/hooks'
import { useMenuFilterStore } from '@/stores'

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
      backgroundColor: primaryColor,
    }
  })

  return <Animated.View style={[dotStyle, { height: 6, borderRadius: 3 }]} />
}

// ─── Card — extended index drives centeredAt ──────────────────────────────────

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

  const animStyle = useAnimatedStyle(() => {
    'worklet'
    const inputRange = [centeredAt - step, centeredAt, centeredAt + step]
    const scale = interpolate(scrollX.value, inputRange, [0.86, 1, 0.86], 'clamp')
    const opacity = interpolate(scrollX.value, inputRange, [0.55, 1, 0.55], 'clamp')
    const translateY = interpolate(scrollX.value, inputRange, [12, 0, 12], 'clamp')
    return { transform: [{ scale }, { translateY }], opacity }
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
          marginLeft: extendedIndex === 0 ? 0 : CARD_GAP,
          borderRadius: 20,
        },
        animStyle,
      ]}
    >
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
            style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}
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
    </Animated.View>
  )
})

// ─── Carousel ─────────────────────────────────────────────────────────────────

interface HighlightMenuCarouselProps {
  items?: HighlightMenuItem[]
  primaryColor?: string
}

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<HighlightMenuItem>,
)

/**
 * Focus-card carousel với infinite scroll.
 * Extended data: [cloneOfLast, ...items, cloneOfFirst]
 * Teleport on boundaries so the user never sees an end.
 */
const HighlightMenuCarousel = React.memo(function HighlightMenuCarousel({
  items,
  primaryColor = '#000',
}: HighlightMenuCarouselProps) {
  const { t } = useTranslation('home')
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const highlightMenus = items ?? DEFAULT_HIGHLIGHT_MENUS
  const count = highlightMenus.length

  const { data: catalogResponse } = useCatalog()
  const setMenuFilter = useMenuFilterStore((s) => s.setMenuFilter)

  const cardWidth = screenWidth * 0.72
  const cardHeight = cardWidth * 1.28
  const sideInset = (screenWidth - cardWidth) / 2
  const step = cardWidth + CARD_GAP

  /**
   * Infinite data: [lastClone, item0, item1, ..., itemN-1, firstClone]
   * Real items live at extended indices 1..count.
   * At scroll offset k*step, item at extended index k is centered.
   */
  const extendedMenus = useMemo(() => {
    if (count <= 1) return highlightMenus
    return [
      highlightMenus[count - 1],
      ...highlightMenus,
      highlightMenus[0],
    ]
  }, [highlightMenus, count])

  // Ref for imperative scrollToOffset during teleport.
  // createAnimatedComponent forwards the ref to the wrapped FlatList.
  const listRef = useRef<FlatList<HighlightMenuItem>>(null)

  // scrollX tracks raw FlatList content offset.
  // Real first item lives at offset 1*step, so init there.
  const scrollX = useSharedValue(count > 1 ? step : 0)

  const scrollHandler = useAnimatedScrollHandler((e) => {
    'worklet'
    scrollX.value = e.contentOffset.x
  })

  // On mount: jump to real first item (skip the cloned-last at extended index 0)
  useEffect(() => {
    if (count <= 1) return
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: step, animated: false })
    })
  // run once; step is stable for a given screen width
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // Teleport on scroll boundaries (called after momentum ends)
  const handleScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (count <= 1) return
      const rawIndex = Math.round(e.nativeEvent.contentOffset.x / step)

      if (rawIndex === 0) {
        // Swiped past beginning → jump to real last item
        const target = count * step
        listRef.current?.scrollToOffset({ offset: target, animated: false })
        scrollX.value = target
      } else if (rawIndex === count + 1) {
        // Swiped past end → jump to real first item
        const target = step
        listRef.current?.scrollToOffset({ offset: target, animated: false })
        scrollX.value = target
      }
    },
    [count, step, scrollX],
  )

  const handleItemPress = useCallback(
    (catalogSearch: string) => {
      const catalogs = catalogResponse?.result ?? []
      const matched = catalogs.find((c) =>
        c.name.toLowerCase().includes(catalogSearch.toLowerCase()),
      )
      setMenuFilter((prev) => ({ ...prev, catalog: matched?.slug ?? undefined }))
      router.push('/(tabs)/menu' as never)
    },
    [catalogResponse, setMenuFilter, router],
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
        t={t}
        onPress={handleItemPress}
      />
    ),
    [scrollX, cardWidth, cardHeight, step, t, handleItemPress],
  )

  // Use extended index as key — avoids id collision between clone and original
  const keyExtractor = useCallback(
    (_item: HighlightMenuItem, index: number) => `hl-${index}`,
    [],
  )

  const listContentStyle = useMemo(
    () => ({ paddingHorizontal: sideInset, alignItems: 'center' as const }),
    [sideInset],
  )

  return (
    <View>
      <AnimatedFlatList
        ref={listRef as React.Ref<FlatList<HighlightMenuItem>>}
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
        style={{ height: cardHeight + 12 }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={() => {}}
      />

      {/* Dot indicators — indexed against real items only.
          Each dot's targetOffset = scroll position where that real item is centered.
          Real item i lives at extended index i+1 → offset (i+1)*step. */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 5,
          marginTop: 12,
        }}
      >
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
