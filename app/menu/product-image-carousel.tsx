import { useEffect, useState } from 'react'
import { Image } from 'expo-image'
import { Dimensions, InteractionManager, Pressable, View } from 'react-native'

import { HIT_SLOP_ICON } from '@/lib/navigation'

import { Images } from '@/assets/images'
import {
  Card,
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui'
import { publicFileURL } from '@/constants'

export default function ProductImageCarousel({
  images,
  onImageClick,
}: {
  images: (string | null | undefined)[]
  onImageClick: (image: string | null) => void
}) {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [current, setCurrent] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)

  const handleImageClick = (
    image: string | null | undefined,
    index: number,
  ) => {
    setAutoScroll(false) // Disable auto-scroll when manually clicking
    setSelectedIndex(index)
    setCurrent(index)
    if (api) {
      api.scrollTo(index)
    }
    onImageClick(image ?? null)
  }

  useEffect(() => {
    if (!api || !autoScroll) return

    let intervalId: ReturnType<typeof setInterval> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      intervalId = setInterval(() => {
        if (api) api.scrollNext()
      }, 3000)
    })

    return () => {
      task.cancel()
      if (intervalId) clearInterval(intervalId)
    }
  }, [api, autoScroll])

  // Re-enable auto-scroll after 5 seconds of inactivity
  useEffect(() => {
    if (autoScroll) return

    const timeoutId = setTimeout(() => {
      setAutoScroll(true)
    }, 5000)

    return () => clearTimeout(timeoutId)
  }, [autoScroll])

  const screenWidth = Dimensions.get('window').width
  const itemWidth = screenWidth / 3 // Show 3 items per screen

  return (
    <View className="flex w-full flex-col items-center gap-2 px-2">
      <Carousel
        opts={{
          align: 'start',
          loop: true, // Enable loop
        }}
        setApi={setApi}
        onIndexChange={setCurrent}
        className="w-full"
      >
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem key={index} className="px-1">
              <View className="flex w-full py-1">
                <Pressable
                  onPress={() => handleImageClick(image, index)}
                  hitSlop={HIT_SLOP_ICON}
                  className="active:opacity-80"
                  {...({ unstable_pressDelay: 0 } as object)}
                >
                  <Card
                    className={`relative w-full overflow-hidden ${
                      selectedIndex === index ? 'ring-2 ring-primary' : ''
                    }`}
                    style={{ width: itemWidth - 8 }}
                  >
                    <Image
                      source={
                        image
                          ? `${publicFileURL}/${image}`
                          : Images.Food.ProductImage
                      }
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      className="h-24 w-full rounded-md"
                    />
                  </Card>
                </Pressable>
              </View>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {images.length > 1 && (
        <View className="mt-4 flex-row gap-2">
          {images.map((image, index) => (
            <Pressable
              key={index}
              onPress={() => handleImageClick(image, index)}
              hitSlop={HIT_SLOP_ICON}
              className={`h-2 rounded-full active:opacity-80 ${
                current === index ? 'w-4 bg-primary' : 'w-2 bg-gray-300'
              }`}
              {...({ unstable_pressDelay: 0 } as object)}
            />
          ))}
        </View>
      )}
    </View>
  )
}
