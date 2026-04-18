import React from 'react'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { ScreenContainer } from '@/components/layout'
import { useSharedElementSource } from '@/lib/shared-element'

const TEST_IMAGE_URI =
  'https://images.pexels.com/photos/2396220/pexels-photo-2396220.jpeg?auto=compress&cs=tinysrgb&w=800'

export default function MenuHeroTestScreen() {
  const router = useRouter()
  const { animatedRef, capture } = useSharedElementSource(TEST_IMAGE_URI)

  const handlePressIn = () => {
    capture()
  }

  const handlePress = () => {
    router.push('/menu-hero-test/detail')
  }

  return (
    <ScreenContainer
      edges={['top']}
      className="flex-1 bg-white dark:bg-gray-900"
    >
      <View className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Text className="text-lg font-bold text-gray-900 dark:text-white">
          Hero Test – Menu
        </Text>
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Tap card để test shared element + JS Stack transition.
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-4">
        <Pressable
          onPressIn={handlePressIn}
          onPress={handlePress}
          className="w-64 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md active:opacity-80 dark:border-gray-700 dark:bg-gray-800"
        >
          <Animated.View
            ref={animatedRef}
            className="h-40 w-full bg-gray-100 dark:bg-gray-700"
          >
            <Image
              source={{ uri: TEST_IMAGE_URI }}
              className="h-full w-full"
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </Animated.View>
          <View className="p-3">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              Iced Coffee – Test
            </Text>
            <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Trang menu đơn giản để test Hero Transition, không có dữ liệu
              thật.
            </Text>
          </View>
        </Pressable>
      </View>
    </ScreenContainer>
  )
}
