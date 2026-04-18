import React from 'react'
import { Image } from 'expo-image'
import { ArrowLeft } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { Platform, Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler'

import { ScreenContainer } from '@/components/layout'
import { useSharedElementDest } from '@/lib/shared-element'

const TEST_IMAGE_URI =
  'https://images.pexels.com/photos/2396220/pexels-photo-2396220.jpeg?auto=compress&cs=tinysrgb&w=800'

export default function MenuHeroTestDetailScreen() {
  const router = useRouter()
  const {
    animatedRef: heroRef,
    onLayout: onHeroLayout,
    contentStyle,
  } = useSharedElementDest()

  return (
    <ScreenContainer
      edges={['top']}
      className="flex-1 bg-white dark:bg-gray-900"
    >
      <Animated.View style={contentStyle} className="flex-1">
        <View className="flex-row items-center border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <Pressable
            onPress={() => router.back()}
            className="p-2 active:opacity-70"
          >
            <ArrowLeft size={24} color="#111827" />
          </Pressable>
          <Text className="ml-2 text-lg font-bold text-gray-900 dark:text-white">
            Hero Test – Detail
          </Text>
        </View>

        <View
          className="flex-1"
          {...(Platform.OS === 'android' && {
            renderToHardwareTextureAndroid: true,
          })}
        >
          <GestureScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
          >
            <View className="px-4 pt-4">
              <Animated.View
                ref={heroRef}
                onLayout={onHeroLayout}
                className="mb-4 overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-700"
                style={{ height: 220 }}
              >
                <Image
                  source={{ uri: TEST_IMAGE_URI }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                />
              </Animated.View>

              <View className="mt-2">
                <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">
                  Iced Coffee – Hero Transition
                </Text>
                <Text className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Đây là trang chi tiết test, không fetch dữ liệu, chỉ dùng để
                  kiểm tra:
                </Text>
                <Text className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  • Hero Transition từ thumbnail → header image{'\n'}• Native
                  Stack hãm phanh (NativeStackWithMasterTransition){'\n'}• Không
                  flicker, không double image
                </Text>
              </View>
            </View>
          </GestureScrollView>
        </View>
      </Animated.View>
    </ScreenContainer>
  )
}
