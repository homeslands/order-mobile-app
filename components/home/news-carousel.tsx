// import { Image } from 'expo-image'
// import React, { useCallback, useMemo, useRef } from 'react'
// import { FlatList, Text, useWindowDimensions, View } from 'react-native'

// import { NativeGesturePressable } from '@/components/navigation/native-gesture-pressable'
// import { useGhostMount } from '@/lib/navigation'
// import { NewsArticle } from '@/types'

// interface NewsCarouselProps {
//   articles?: NewsArticle[]
// }

// export default function NewsCarousel({ articles }: NewsCarouselProps) {
//   const flatListRef = useRef<FlatList>(null)
//   const { width: screenWidth } = useWindowDimensions()
//   const { preload } = useGhostMount()

//   if (!articles || articles.length === 0) return null

//   const itemWidth = screenWidth < 640 ? 180 : 320
//   const itemSpacing = 8
//   const horizontalPadding = screenWidth < 640 ? 16 : 20

//   const keyExtractor = useCallback((item: NewsArticle) => item.id, [])

//   const renderItem = useCallback(
//     ({ item, index }: { item: NewsArticle; index: number }) => {
//       const thumbSource =
//         typeof item.thumbnail === 'string'
//           ? { uri: item.thumbnail }
//           : (item.thumbnail as number)

//       return (
//         <View
//           style={{
//             width: itemWidth,
//             marginLeft: index === 0 ? horizontalPadding : itemSpacing,
//             marginRight: itemSpacing,
//           }}
//         >
//           <NativeGesturePressable
//             navigation={{ type: 'push', href: `/home/news/${item.slug}` }}
//             onPressIn={() => preload('news', { slug: item.slug })}
//             className="w-full bg-transparent"
//           >
//             <View className="w-full flex-col">
//               <View
//                 className="relative w-full overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-700"
//                 style={{ aspectRatio: 4 / 3 }}
//               >
//                 <Image
//                   source={thumbSource}
//                   style={{ width: '100%', height: '100%' }}
//                   contentFit="cover"
//                   cachePolicy="memory-disk"
//                   recyclingKey={item.id}
//                   transition={120}
//                 />
//               </View>

//               <View className="flex-1 flex-col py-3 sm:py-4">
//                 <Text
//                   className="text-base font-bold text-gray-900 dark:text-white sm:text-lg"
//                   numberOfLines={2}
//                   style={{ minHeight: 56 }}
//                 >
//                   {item.title}
//                 </Text>
//                 <Text
//                   className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm"
//                   numberOfLines={screenWidth < 640 ? 2 : 3}
//                 >
//                   {item.summary}
//                 </Text>
//               </View>
//             </View>
//           </NativeGesturePressable>
//         </View>
//       )
//     },
//     [itemWidth, itemSpacing, horizontalPadding, preload, screenWidth],
//   )

//   const contentContainerStyle = useMemo(
//     () => ({ paddingRight: horizontalPadding }),
//     [horizontalPadding],
//   )

//   const getItemLayout = useCallback(
//     (_data: ArrayLike<NewsArticle> | null | undefined, index: number) => {
//       const offset =
//         index === 0
//           ? horizontalPadding
//           : horizontalPadding + (itemWidth + itemSpacing * 2) * index
//       return {
//         length: itemWidth + itemSpacing * 2,
//         offset,
//         index,
//       }
//     },
//     [horizontalPadding, itemWidth, itemSpacing],
//   )

//   return (
//     <View className="w-full items-center">
//       <FlatList
//         ref={flatListRef}
//         data={articles}
//         renderItem={renderItem}
//         keyExtractor={keyExtractor}
//         horizontal
//         initialNumToRender={3}
//         maxToRenderPerBatch={2}
//         windowSize={3}
//         showsHorizontalScrollIndicator={false}
//         contentContainerStyle={contentContainerStyle}
//         snapToInterval={itemWidth + itemSpacing * 2}
//         decelerationRate="fast"
//         getItemLayout={getItemLayout}
//         removeClippedSubviews
//       />
//     </View>
//   )
// }
