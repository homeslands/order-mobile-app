import { Image } from 'expo-image'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Dimensions, Pressable, View } from 'react-native'
import Carousel, {
  CarouselRenderItem,
  ICarouselInstance,
} from 'react-native-reanimated-carousel'

import { Images } from '@/assets/images'
import { publicFileURL } from '@/constants'
import { HIT_SLOP_ICON } from '@/lib/navigation/constants'

const SCREEN_WIDTH = Dimensions.get('window').width

interface ProductImageCarouselProps {
  images: (string | null)[]
  currentIndex: number
  onIndexChange?: (index: number) => void
}

const ProductImageCarousel = React.memo(function ProductImageCarousel({
  images,
  currentIndex,
  onIndexChange,
}: ProductImageCarouselProps) {
  const validImages = useMemo(
    () => images.filter(Boolean) as string[],
    [images],
  )

  const carouselWidth = useMemo(
    () => Math.min(SCREEN_WIDTH - 32, 68 * validImages.length),
    [validImages.length],
  )

  const carouselRef = useRef<ICarouselInstance | null>(null)

  const renderItem: CarouselRenderItem<string> = useCallback(
    ({ item, index }) => {
      const imageUrl = `${publicFileURL}/${item}`
      const isActive = index === currentIndex

      return (
        <Pressable
          onPress={() => onIndexChange?.(index)}
          hitSlop={HIT_SLOP_ICON}
          unstable_pressDelay={0}
          android_ripple={null}
          className={`mr-2 overflow-hidden rounded-lg border active:opacity-90 ${
            isActive
              ? 'border-red-600 dark:border-primary'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          style={{ width: 60, height: 60 }}
        >
          <Image
            source={{ uri: imageUrl }}
            placeholder={Images.Food.ProductImage}
            placeholderContentFit="cover"
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="normal"
            recyclingKey={item}
            className="h-full w-full"
          />
        </Pressable>
      )
    },
    [currentIndex, onIndexChange],
  )

  useEffect(() => {
    if (!validImages.length) return
    if (currentIndex < 0 || currentIndex >= validImages.length) return
    carouselRef.current?.scrollTo({ index: currentIndex, animated: true })
  }, [currentIndex, validImages.length])

  if (!validImages.length) return null

  return (
    <View className="w-full flex-col items-center gap-2 px-2">
      <Carousel
        ref={carouselRef}
        width={68}
        height={68}
        data={validImages}
        loop={validImages.length > 1}
        style={{ width: carouselWidth }}
        onSnapToItem={(index) => onIndexChange?.(index)}
        renderItem={renderItem}
      />
    </View>
  )
})

export default ProductImageCarousel
