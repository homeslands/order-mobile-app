import { useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageSourcePropType, ViewStyle } from 'react-native'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import Carousel, { type CarouselRenderItem } from 'react-native-reanimated-carousel'

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
    // wrap-around: shortest circular distance between progress and this dot's index
    const dist = Math.min(raw, count - raw)
    const active = interpolate(dist, [0, 1], [1, 0], 'clamp')
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
      // sideInset: left offset so the centered item's visual center = screenWidth/2
      sideInset: (screenWidth - s) / 2,
      step: s,
    }
  }, [screenWidth])

  // absoluteProgress is driven by the library: 0.0 when item 0 centered, 1.0 when item 1, etc.
  const absoluteProgress = useSharedValue(0)

  // customAnimation runs on UI thread. value = x.value / step (normalized offset from center).
  // Items are position:absolute — translateX is REQUIRED for layout.
  // translateX formula: sideInset + value * step centers the item at value=0.
  const customAnimation = useCallback(
    (value: number, _index: number): ViewStyle => {
      'worklet'
      const p = Math.max(0, 1 - Math.abs(value))
      return {
        opacity: 0.55 + 0.45 * p,
        transform: [
          { translateX: sideInset + value * step },
          { scale: 0.86 + 0.14 * p },
          { translateY: 12 * (1 - p) },
        ] as ViewStyle['transform'],
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
          // catalog fetch failed — menu shown without filter
        })
    },
    [queryClient, setMenuFilter, router],
  )

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
