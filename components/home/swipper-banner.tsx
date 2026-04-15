import { Image } from 'expo-image'
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { Images } from '@/assets/images'
import { ROUTE, SPRING_CONFIGS, TIMING_CONFIGS, publicFileURL } from '@/constants'
import { navigateNative } from '@/lib/navigation'
import type { IBanner } from '@/types'
import type { ImageSourcePropType } from 'react-native'

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_SCROLL_INTERVAL = 3500
const ROUTE_VALUES = Object.values(ROUTE)
const DOT_SIZE = 7
const DOT_ACTIVE_WIDTH = 20
const DOT_GAP = 5

const SCREEN_W = Dimensions.get('window').width

// ─── Dot indicator ───────────────────────────────────────────────────────────

const BannerDot = React.memo(function BannerDot({
  isActive,
}: {
  isActive: boolean
}) {
  const width = useDerivedValue(() =>
    withSpring(isActive ? DOT_ACTIVE_WIDTH : DOT_SIZE, SPRING_CONFIGS.dotExpand),
  )
  const opacity = useDerivedValue(() =>
    withTiming(isActive ? 1 : 0.45, TIMING_CONFIGS.dotFade),
  )
  const style = useAnimatedStyle(() => ({
    width: width.value,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#fff',
    opacity: opacity.value,
  }))
  return <Animated.View style={style} />
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBannerSource(banner: IBanner): ImageSourcePropType {
  if (banner.image) {
    if (banner.image.startsWith('http')) return { uri: banner.image }
    const url = publicFileURL
      ? `${publicFileURL}/${banner.image}`
      : banner.image
    return { uri: url }
  }
  return Images.Landing.Desktop
}

function extractPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function isInternalRoute(url: string, routeValues: string[]): boolean {
  if (!url?.trim()) return true
  if (!url.startsWith('http://') && !url.startsWith('https://')) return true
  try {
    const pathname = new URL(url).pathname
    return routeValues.some(
      (r) => pathname === r || pathname.startsWith(r + '/'),
    )
  } catch {
    return true
  }
}

// ─── Slide item ───────────────────────────────────────────────────────────────

interface SlideItemProps {
  banner: IBanner
  slideHeight: number
  onPress: (banner: IBanner) => void
}

const SlideItem = React.memo(function SlideItem({
  banner,
  slideHeight,
  onPress,
}: SlideItemProps) {
  const source = getBannerSource(banner)

  return (
    <Pressable
      onPress={() => onPress(banner)}
      style={{ width: SCREEN_W, height: slideHeight, overflow: 'hidden' }}
    >
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        cachePolicy="memory-disk"
        transition={250}
      />
    </Pressable>
  )
})

// ─── Component ───────────────────────────────────────────────────────────────

interface SwiperBannerProps {
  bannerData: IBanner[]
  height: number
}

const SwiperBanner = React.memo(function SwiperBanner({
  bannerData,
  height: slideHeight,
}: SwiperBannerProps): React.ReactElement | null {
  const flatListRef = useRef<FlatList>(null)
  const count = bannerData.length

  /**
   * Infinite scroll — clone last at front, first at back:
   *   [last, item0, item1, ..., itemN, first]
   */
  const infiniteData = useMemo(() => {
    if (count <= 1) return bannerData
    return [bannerData[count - 1], ...bannerData, bannerData[0]]
  }, [bannerData, count])

  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const infiniteIndexRef = useRef(1)

  useEffect(() => {
    if (count <= 1) return
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({ index: 1, animated: false })
    })
  }, [count])

  useEffect(() => {
    if (count <= 1) return
    const interval = setInterval(() => {
      const next = infiniteIndexRef.current + 1
      flatListRef.current?.scrollToIndex({ index: next, animated: true })
    }, AUTO_SCROLL_INTERVAL)
    return () => clearInterval(interval)
  }, [count])

  const handleScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (count <= 1) return
      const rawIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)

      if (rawIndex === 0) {
        flatListRef.current?.scrollToIndex({ index: count, animated: false })
        infiniteIndexRef.current = count
        activeIndexRef.current = count - 1
        setActiveIndex(count - 1)
        return
      }
      if (rawIndex === count + 1) {
        flatListRef.current?.scrollToIndex({ index: 1, animated: false })
        infiniteIndexRef.current = 1
        activeIndexRef.current = 0
        setActiveIndex(0)
        return
      }

      const realIndex = rawIndex - 1
      infiniteIndexRef.current = rawIndex
      activeIndexRef.current = realIndex
      setActiveIndex(realIndex)
    },
    [count],
  )

  const handleBannerPress = useCallback((banner: IBanner) => {
    const url = banner.url?.trim()
    if (!url) return
    const internal = isInternalRoute(url, ROUTE_VALUES)
    const dest = internal ? extractPathname(url) : url
    if (internal) {
      navigateNative.push(dest as Parameters<typeof navigateNative.push>[0])
    } else {
      Linking.openURL(dest).catch(() => {})
    }
  }, [])

  const renderItem = useCallback(
    ({ item: banner }: { item: IBanner }) => (
      <SlideItem
        banner={banner}
        slideHeight={slideHeight}
        onPress={handleBannerPress}
      />
    ),
    [slideHeight, handleBannerPress],
  )

  const keyExtractor = useCallback(
    (_: IBanner, index: number) => index.toString(),
    [],
  )

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_W,
      offset: SCREEN_W * index,
      index,
    }),
    [],
  )

  if (!count) return null

  return (
    <View style={{ width: '100%', height: slideHeight }}>
      <FlatList
        ref={flatListRef}
        data={infiniteData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={() => {}}
        removeClippedSubviews
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={3}
      />

      {count > 1 && (
        <View style={s.dots}>
          {bannerData.map((_, i) => (
            <BannerDot key={i} isActive={i === activeIndex} />
          ))}
        </View>
      )}
    </View>
  )
})

export default SwiperBanner

const s = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: DOT_GAP,
  },
})
