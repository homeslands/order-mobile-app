import { cn } from '@/utils/cn'
import { colors } from '@/constants'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, FlatList, ScrollView, TouchableOpacity, View } from 'react-native'

interface CarouselProps {
  children: React.ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
  opts?: {
    align?: 'start' | 'center' | 'end'
    loop?: boolean
  }
  setApi?: (api: CarouselApi) => void
  onIndexChange?: (index: number) => void
}

interface CarouselContextValue {
  orientation: 'horizontal' | 'vertical'
  scrollNext: () => void
  scrollPrev: () => void
  canScrollNext: boolean
  canScrollPrev: boolean
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)
  if (!context) {
    throw new Error('useCarousel must be used within <Carousel />')
  }
  return context
}

export interface CarouselApi {
  scrollNext: () => void
  scrollPrev: () => void
  scrollTo: (index: number) => void
  canScrollNext: boolean
  canScrollPrev: boolean
}

function Carousel({
  children,
  className,
  orientation = 'horizontal',
  opts = {},
  setApi,
  onIndexChange,
}: CarouselProps) {
  const { align = 'start', loop = false } = opts
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const flatListRef = useRef<FlatList>(null)
  const screenWidth = Dimensions.get('window').width
  const screenHeight = Dimensions.get('window').height

  // Extract children array
  const childrenArray = React.Children.toArray(children)
  const itemCount = childrenArray.length

  // Calculate scroll states using useMemo (no state needed)
  const canScrollPrev = useMemo(() => loop || currentIndex > 0, [loop, currentIndex])
  const canScrollNext = useMemo(() => loop || currentIndex < itemCount - 1, [loop, currentIndex, itemCount])

  const scrollNext = useCallback(() => {
    if (currentIndex < itemCount - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      if (orientation === 'horizontal') {
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true })
      } else {
        scrollViewRef.current?.scrollTo({
          y: nextIndex * screenHeight,
          animated: true,
        })
      }
    } else if (loop) {
      setCurrentIndex(0)
      if (orientation === 'horizontal') {
        flatListRef.current?.scrollToIndex({ index: 0, animated: true })
      } else {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true })
      }
    }
  }, [currentIndex, itemCount, loop, orientation, screenHeight])

  const scrollPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      if (orientation === 'horizontal') {
        flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true })
      } else {
        scrollViewRef.current?.scrollTo({
          y: prevIndex * screenHeight,
          animated: true,
        })
      }
    } else if (loop) {
      const lastIndex = itemCount - 1
      setCurrentIndex(lastIndex)
      if (orientation === 'horizontal') {
        flatListRef.current?.scrollToIndex({ index: lastIndex, animated: true })
      } else {
        scrollViewRef.current?.scrollTo({
          y: lastIndex * screenHeight,
          animated: true,
        })
      }
    }
  }, [currentIndex, itemCount, loop, orientation, screenHeight])

  useEffect(() => {
    if (setApi) {
      setApi({
        scrollNext,
        scrollPrev,
        scrollTo: (index: number) => {
          setCurrentIndex(index)
          onIndexChange?.(index)
          if (orientation === 'horizontal') {
            flatListRef.current?.scrollToIndex({ index, animated: true })
          } else {
            scrollViewRef.current?.scrollTo({
              y: index * screenHeight,
              animated: true,
            })
          }
        },
        canScrollNext,
        canScrollPrev,
      })
    }
  }, [setApi, scrollNext, scrollPrev, canScrollNext, canScrollPrev, orientation, screenHeight, onIndexChange])

  const contextValue: CarouselContextValue = {
    orientation,
    scrollNext,
    scrollPrev,
    canScrollNext,
    canScrollPrev,
  }

  const renderItem = useCallback(
    ({ item }: { item: React.ReactNode }) => (
      <View className="w-full">{item}</View>
    ),
    [],
  )

  if (orientation === 'horizontal') {
    return (
      <CarouselContext.Provider value={contextValue}>
        <View className={cn('relative w-full', className)}>
          <FlatList
            ref={flatListRef}
            data={childrenArray}
            renderItem={renderItem}
            keyExtractor={(_, index) => `carousel-item-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth)
              setCurrentIndex(index)
              onIndexChange?.(index)
            }}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            contentContainerStyle={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}
          />
        </View>
      </CarouselContext.Provider>
    )
  }

  return (
    <CarouselContext.Provider value={contextValue}>
      <View className={cn('relative w-full', className)}>
        <ScrollView
          ref={scrollViewRef}
          horizontal={false}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.y / screenHeight)
            setCurrentIndex(index)
            onIndexChange?.(index)
          }}
          contentContainerStyle={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}
        >
          {childrenArray.map((child, index) => (
            <View key={`carousel-item-${index}`} style={{ height: screenHeight, width: '100%' }}>
              {child}
            </View>
          ))}
        </ScrollView>
      </View>
    </CarouselContext.Provider>
  )
}

interface CarouselContentProps {
  children: React.ReactNode
  className?: string
}

function CarouselContent({ children, className }: CarouselContentProps) {
  const { orientation } = useCarousel()

  if (orientation === 'horizontal') {
    return (
      <View className={cn('flex-row', className)}>
        {children}
      </View>
    )
  }

  return (
    <View className={cn('flex-col', className)}>
      {children}
    </View>
  )
}

interface CarouselItemProps {
  children: React.ReactNode
  className?: string
}

function CarouselItem({ children, className }: CarouselItemProps) {
  const { orientation } = useCarousel()
  const screenWidth = Dimensions.get('window').width
  const screenHeight = Dimensions.get('window').height

  return (
    <View
      className={cn('flex-none', className)}
      style={
        orientation === 'horizontal'
          ? { width: screenWidth }
          : { height: screenHeight, width: '100%' }
      }
    >
      {children}
    </View>
  )
}

interface CarouselPreviousProps {
  className?: string
  variant?: 'default' | 'outline'
  size?: 'default' | 'icon'
}

function CarouselPrevious({ className, variant: _variant = 'outline', size = 'default' }: CarouselPreviousProps) {
  const { scrollPrev, canScrollPrev, orientation } = useCarousel()

  return (
    <TouchableOpacity
      onPress={scrollPrev}
      disabled={!canScrollPrev}
      className={cn(
        'absolute z-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
        orientation === 'horizontal' ? 'left-2 top-1/2 -translate-y-1/2' : 'top-2 left-1/2 -translate-x-1/2 rotate-90',
        size === 'default' ? 'h-8 w-8' : 'h-9 w-9',
        !canScrollPrev && 'opacity-50',
        className
      )}
    >
      <ChevronLeft size={16} color={colors.gray[700]} />
    </TouchableOpacity>
  )
}

interface CarouselNextProps {
  className?: string
  variant?: 'default' | 'outline'
  size?: 'default' | 'icon'
}

function CarouselNext({ className, variant: _variant = 'outline', size = 'default' }: CarouselNextProps) {
  const { scrollNext, canScrollNext, orientation } = useCarousel()

  return (
    <TouchableOpacity
      onPress={scrollNext}
      disabled={!canScrollNext}
      className={cn(
        'absolute z-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
        orientation === 'horizontal' ? 'right-2 top-1/2 -translate-y-1/2' : 'bottom-2 left-1/2 -translate-x-1/2 rotate-90',
        size === 'default' ? 'h-8 w-8' : 'h-9 w-9',
        !canScrollNext && 'opacity-50',
        className
      )}
    >
      <ChevronRight size={16} color={colors.gray[700]} />
    </TouchableOpacity>
  )
}

// Compose component (shadcn pattern)
Carousel.Content = CarouselContent
Carousel.Item = CarouselItem
Carousel.Previous = CarouselPrevious
Carousel.Next = CarouselNext

export { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, useCarousel }

