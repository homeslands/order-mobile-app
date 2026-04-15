import { useIsFocused } from '@react-navigation/native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { Suspense, lazy, useMemo } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

const RelatedProducts = lazy(() => import('@/components/menu/related-products'))

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const isFocused = useIsFocused()
  const scrollY = useSharedValue(0)

  const product = useMemo(
    () => ({
      id: id ?? 'unknown',
      name: `Product ${id ?? ''}`,
      price: 59000,
    }),
    [id],
  )

  // Parallax tinh tren UI thread (worklet) nen khong can JS moi frame scroll.
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })

  const headerStyle = useAnimatedStyle(() => {
    const y = Math.max(-140, scrollY.value)
    return {
      transform: [{ translateY: y * 0.45 }, { scale: scrollY.value < 0 ? 1.1 : 1 }],
    }
  })

  React.useEffect(() => {
    if (!isFocused) {
      // Release memory som khi blur de han che peak RAM trong flow chuyen man.
      queueMicrotask(() => Image.clearMemoryCache())
    }
  }, [isFocused])

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-4 pb-3 pt-12">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="font-semibold text-blue-600 dark:text-blue-400">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/cart')}>
          <Text className="font-semibold text-blue-600 dark:text-blue-400">Cart</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Animated.View
          style={[headerStyle, { height: 220 }]}
          className="items-center justify-center bg-gray-200 dark:bg-gray-800"
        >
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Parallax Header
          </Text>
        </Animated.View>

        <View className="p-4">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</Text>
          <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">Product ID: {product.id}</Text>
          <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Product detail page is intentionally empty for transition benchmark.
          </Text>

          {/* Lazy section: hoan mount block phu de giam JS cost frame dau. */}
          <Suspense
            fallback={
              <View className="mt-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Loading related products...
                </Text>
              </View>
            }
          >
            <RelatedProducts />
          </Suspense>
        </View>
      </Animated.ScrollView>
    </View>
  )
}
