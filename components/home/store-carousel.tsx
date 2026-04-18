import { Image } from 'expo-image'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { Dimensions, FlatList, InteractionManager, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { DOT_SCALE_ACTIVE, SPRING_CONFIGS } from '@/constants'

interface StoreCarouselProps {
  images?: ImageSourcePropType[]
}

// ─── PaginationDot — must live OUTSIDE StoreCarousel ─────────────────────────
// Defining it inside causes React to create a new component type on every parent
// re-render, which unmounts + remounts dots and resets their animations.

const PaginationDot = React.memo(function PaginationDot({
  isActive,
}: {
  isActive: boolean
}) {
  const scale = useSharedValue(isActive ? DOT_SCALE_ACTIVE : 1)

  useEffect(() => {
    scale.value = withSpring(
      isActive ? DOT_SCALE_ACTIVE : 1,
      SPRING_CONFIGS.dot,
    )
  }, [isActive, scale])

  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ scale: scale.value }],
    }
  })

  return (
    <Animated.View
      style={animatedStyle}
      className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : 'bg-white/50'}`}
    />
  )
})

// ─── StoreCarousel ────────────────────────────────────────────────────────────

const StoreCarousel = React.memo(function StoreCarousel({
  images,
}: StoreCarouselProps) {
  const flatListRef = useRef<FlatList>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const screenWidth = Dimensions.get('window').width

  const carouselImages = useMemo(() => images ?? [], [images])
  const count = carouselImages.length

  const handleScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth)
      if (index >= 0 && index < count && index !== activeIndexRef.current) {
        activeIndexRef.current = index
        setActiveIndex(index)
      }
    },
    [screenWidth, count],
  )

  // Auto-scroll — uses ref to avoid stale closure; deferred after interactions
  useEffect(() => {
    if (count <= 1) return

    let intervalId: ReturnType<typeof setInterval> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      intervalId = setInterval(() => {
        const next = (activeIndexRef.current + 1) % count
        flatListRef.current?.scrollToIndex({ index: next, animated: true })
      }, 3000)
    })

    return () => {
      task.cancel()
      if (intervalId) clearInterval(intervalId)
    }
  }, [count])

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [screenWidth],
  )

  const renderItem = useCallback(
    ({ item }: { item: ImageSourcePropType }) => (
      <View style={{ width: screenWidth }}>
        <View
          className="w-full overflow-hidden rounded-xl"
          style={{ aspectRatio: 16 / 9 }}
        >
          <Image
            source={item}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      </View>
    ),
    [screenWidth],
  )

  const pagination = useMemo(
    () => (
      <View
        className="absolute bottom-4 left-0 right-0 flex-row items-center justify-center"
        style={{ gap: 8 }}
      >
        {carouselImages.map((_, index) => (
          <PaginationDot key={index} isActive={index === activeIndex} />
        ))}
      </View>
    ),
    [carouselImages, activeIndex],
  )

  return (
    <View className="mx-auto w-full max-w-6xl overflow-hidden rounded-xl">
      <FlatList
        ref={flatListRef}
        data={carouselImages}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        horizontal
        pagingEnabled
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((resolve) => setTimeout(resolve, 500))
          wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
            })
          })
        }}
      />
      {pagination}
    </View>
  )
})

export default StoreCarousel
