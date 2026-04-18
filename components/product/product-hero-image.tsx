import { Image } from 'expo-image'
import React, { memo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import {
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import Animated from 'react-native-reanimated'
import Carousel, {
  type CarouselRenderItem,
} from 'react-native-reanimated-carousel'

import { colors } from '@/constants'

const AnimatedExpoImage = Animated.createAnimatedComponent(Image)
const HERO_IMAGE_BLURHASH = '|rF?hV%2WCj[ayj[a}ayfQfQfQfQj[j[fQfQfQfQfQfQfQfQfQ'
export const HERO_HEIGHT = 290
/** LRU-style cache — max 200 URLs, evicts oldest when full */
const MAX_CACHED_URLS = 200
const knownCachedUrls = new Set<string>()

function addCachedUrl(url: string) {
  if (knownCachedUrls.has(url)) {
    // Move to end (most recent) by re-adding
    knownCachedUrls.delete(url)
    knownCachedUrls.add(url)
    return
  }
  if (knownCachedUrls.size >= MAX_CACHED_URLS) {
    // Evict oldest (first entry in Set insertion order)
    const oldest = knownCachedUrls.values().next().value
    if (oldest) knownCachedUrls.delete(oldest)
  }
  knownCachedUrls.add(url)
}

type ProductHeroImageProps = {
  imageUrl: string | null
  imageUrls?: string[]
  style?: StyleProp<ViewStyle>
}

const HeroSlideImage = React.memo(function HeroSlideImage({
  url,
  bgColor,
}: {
  url: string
  bgColor: string
}) {
  const [transitionMs, setTransitionMs] = React.useState(() =>
    knownCachedUrls.has(url) ? 0 : 120,
  )

  React.useEffect(() => {
    if (knownCachedUrls.has(url)) {
      setTransitionMs(0)
      return
    }

    let cancelled = false
    Image.getCachePathAsync(url)
      .then((cachePath) => {
        if (cancelled) return
        if (cachePath) {
          addCachedUrl(url)
          setTransitionMs(0)
        } else {
          setTransitionMs(120)
        }
      })
      .catch(() => {
        if (!cancelled) setTransitionMs(120)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <AnimatedExpoImage
      source={{ uri: url }}
      style={[styles.image, { backgroundColor: bgColor }]}
      contentFit="cover"
      placeholder={HERO_IMAGE_BLURHASH}
      transition={transitionMs}
      priority="high"
      cachePolicy="disk"
      recyclingKey={url}
      allowDownscaling
      enforceEarlyResizing
    />
  )
})

function ProductHeroImageInner({
  imageUrl,
  imageUrls,
  style,
}: ProductHeroImageProps) {
  const { width: screenWidth } = useWindowDimensions()
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const isDark = useColorScheme() === 'dark'
  const placeholderBg = isDark ? colors.gray[800] : colors.gray[200]

  const sources = React.useMemo(() => {
    const merged = [imageUrl, ...(imageUrls ?? [])].filter(
      (url): url is string => !!url,
    )
    return [...new Set(merged)]
  }, [imageUrl, imageUrls])

  React.useEffect(() => {
    setCurrentIndex(0)
  }, [sources.length])

  const renderItem: CarouselRenderItem<string> = React.useCallback(
    ({ item }) => <HeroSlideImage url={item} bgColor={placeholderBg} />,
    [placeholderBg],
  )

  if (sources.length === 0) {
    return (
      <Animated.View
        style={[styles.fallback, { backgroundColor: placeholderBg }, style]}
      />
    )
  }

  if (sources.length === 1) {
    return (
      <Animated.View
        style={[styles.container, { backgroundColor: placeholderBg }, style]}
      >
        <HeroSlideImage url={sources[0]} bgColor={placeholderBg} />
      </Animated.View>
    )
  }

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: placeholderBg }, style]}
    >
      <Carousel
        width={screenWidth}
        height={HERO_HEIGHT}
        data={sources}
        loop={false}
        pagingEnabled
        snapEnabled
        windowSize={2}
        onSnapToItem={(index) => setCurrentIndex(index)}
        renderItem={renderItem}
      />
      <View style={styles.counterWrap} pointerEvents="none">
        <Text style={styles.counterText}>
          {currentIndex + 1}/{sources.length}
        </Text>
      </View>
    </Animated.View>
  )
}

export const ProductHeroImage = memo(ProductHeroImageInner)

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: HERO_HEIGHT,
  },
  fallback: {
    width: '100%',
    height: HERO_HEIGHT,
  },
  counterWrap: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
})
