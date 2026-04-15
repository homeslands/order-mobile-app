/**
 * Skeleton shell cho màn Menu Item Detail.
 * Dùng chung cho: Ghost Mount (pre-render) và màn thật (initial state).
 *
 * Task 5.1: Khi có ParallaxDriver, dùng useAnimatedStyle lái translateX theo transitionProgress
 * → Skeleton trượt cùng tốc độ và hướng với Native Stack (slide_from_right).
 *
 * Task 5.2: Layout và kích thước khớp MenuItemDetailContent — tránh jump khi content load.
 *
 * Task 6.1: Định nghĩa kích thước cố định — dùng MENU_ITEM_DETAIL_LAYOUT constants.
 */
import React, { useMemo } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated'

import { MENU_ITEM_DETAIL_LAYOUT } from '@/constants/menu-item-detail-layout'
import { ScreenContainer } from '@/components/layout/screen-container'
import { Skeleton } from '@/components/ui'
import { useParallaxDriverOptional } from '@/lib/transitions'

const { PADDING_X, PADDING_TOP_IMAGES, PADDING_Y_INFO, PADDING_BOTTOM, GAP_3, GAP_4, GAP_2, GAP_6 } =
  MENU_ITEM_DETAIL_LAYOUT

export function MenuItemSkeletonShell() {
  const driver = useParallaxDriverOptional()
  const { width: screenWidth } = useWindowDimensions()

  const imageContainerStyle = useMemo(
    () => ({
      width: MENU_ITEM_DETAIL_LAYOUT.imageContainerSize(screenWidth),
      height: MENU_ITEM_DETAIL_LAYOUT.imageContainerSize(screenWidth),
    }),
    [screenWidth],
  )

  const relatedItemWidth = useMemo(
    () => MENU_ITEM_DETAIL_LAYOUT.relatedProductItemWidth(screenWidth),
    [screenWidth],
  )

  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    if (!driver) return {}
    const p = driver.progress.value
    const translateX = interpolate(p, [0, 1], [driver.screenWidth, 0])
    return { transform: [{ translateX }] }
  }, [driver])

  const content = (
    <>
      {/* Header — padding 16, justify-between */}
      <View
        className="flex-row items-center justify-between border-b border-gray-200 dark:border-gray-700"
        style={{ paddingHorizontal: PADDING_X, paddingVertical: 12 }}
      >
        <Skeleton style={{ width: 32, height: 32 }} className="rounded-full" />
        <Skeleton style={{ width: 128, height: 20 }} className="rounded-md" />
        <View style={{ width: 40, height: 40 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Product Images — padding 16, image container size */}
        <View style={{ paddingHorizontal: PADDING_X, paddingTop: PADDING_TOP_IMAGES }}>
          <View
            className="overflow-hidden rounded-lg"
            style={[
              imageContainerStyle,
              { marginBottom: MENU_ITEM_DETAIL_LAYOUT.IMAGE_MARGIN_BOTTOM },
            ]}
          >
            <Skeleton className="h-full w-full rounded-lg" />
          </View>
        </View>

        {/* Product Info — padding 16, paddingVertical 24, gap 16 */}
        <View
          style={{
            paddingHorizontal: PADDING_X,
            paddingVertical: PADDING_Y_INFO,
          }}
        >
          <View style={{ flexDirection: 'column', gap: GAP_4 } as object}>
            {/* Name + Description */}
            <View style={{ flexDirection: 'column', gap: 4 } as object}>
              <Skeleton style={{ width: '75%', height: 32 }} className="rounded-md" />
              <Skeleton style={{ width: '50%', height: 16 }} className="rounded-md" />
            </View>
            {/* Price */}
            <View style={{ flexDirection: 'column', gap: GAP_2 } as object}>
              <Skeleton style={{ width: 80, height: 24 }} className="rounded-md" />
            </View>
            {/* Size Selector — gap 24 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP_6 } as object}>
              <Skeleton style={{ width: 72, height: 16 }} className="rounded-md" />
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: GAP_2 } as object}>
                <Skeleton style={{ width: 48, height: 32 }} className="rounded-full" />
                <Skeleton style={{ width: 48, height: 32 }} className="rounded-full" />
                <Skeleton style={{ width: 48, height: 32 }} className="rounded-full" />
              </View>
            </View>
            {/* Quantity Selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP_6 } as object}>
              <Skeleton style={{ width: 72, height: 16 }} className="rounded-md" />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: GAP_2 } as object}>
                <Skeleton style={{ width: 120, height: 44 }} className="rounded-full" />
              </View>
            </View>
          </View>
        </View>

        {/* Related Products — padding 16, paddingBottom 24, gap 12 */}
        <View
          style={{
            gap: GAP_3,
            paddingHorizontal: PADDING_X,
            paddingBottom: PADDING_BOTTOM,
          }}
        >
          <Skeleton style={{ width: 128, height: 16 }} className="rounded-md" />
          <View style={{ flexDirection: 'row', gap: GAP_3 } as object}>
            <Skeleton
              style={{
                width: relatedItemWidth,
                height: MENU_ITEM_DETAIL_LAYOUT.RELATED_PRODUCT_IMAGE_HEIGHT,
              }}
              className="rounded-xl"
            />
            <Skeleton
              style={{
                width: relatedItemWidth,
                height: MENU_ITEM_DETAIL_LAYOUT.RELATED_PRODUCT_IMAGE_HEIGHT,
              }}
              className="rounded-xl"
            />
            <Skeleton
              style={{
                width: relatedItemWidth,
                height: MENU_ITEM_DETAIL_LAYOUT.RELATED_PRODUCT_IMAGE_HEIGHT,
              }}
              className="rounded-xl"
            />
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Buttons — padding 16, gap 8 */}
      <View className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <View
          style={{
            paddingHorizontal: PADDING_X,
            paddingVertical: PADDING_X,
            flexDirection: 'row',
            gap: GAP_2,
          }}
        >
          <Skeleton style={{ flex: 1, height: 44 }} className="rounded-full" />
          <Skeleton style={{ flex: 1, height: 44 }} className="rounded-full" />
        </View>
      </View>
    </>
  )

  return (
    <ScreenContainer edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      {driver ? (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>{content}</Animated.View>
      ) : (
        content
      )}
    </ScreenContainer>
  )
}
