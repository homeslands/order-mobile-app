/**
 * TelegramProfileHeader
 *
 * UI: Avatar tròn giữa, Tên căn giữa dưới avatar, SĐT dưới tên.
 * Khi cuộn: Avatar + SĐT mờ dần và di chuyển lên. Tên di chuyển lên và dừng ở header (căn giữa).
 * Không nền expand.
 */

import { Image } from 'expo-image'
import React from 'react'
import {
  FlatList,
  ListRenderItem,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { STATIC_TOP_INSET } from '@/constants/status-bar'

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList)

const AVATAR_SIZE = 120
const HEADER_HEIGHT = 260
const SCROLL_RANGE = 160

export interface ProfileHeaderProps<T> {
  name: string
  phone: string
  avatarUri?: string | null
  initials?: string
  data: T[]
  renderItem: ListRenderItem<T>
  keyExtractor: (item: T) => string
  ListFooterComponent?: React.ComponentType<unknown> | React.ReactElement | null
  contentContainerStyle?: object
  textColor?: string
  textMutedColor?: string
}

export function ProfileHeader<T>({
  name,
  phone,
  avatarUri,
  initials = 'U',
  data,
  renderItem,
  keyExtractor,
  ListFooterComponent,
  contentContainerStyle,
  textColor = '#1a1a1a',
  textMutedColor = '#6b7280',
}: ProfileHeaderProps<T>) {
  const { width: screenWidth } = useWindowDimensions()
  const scrollY = useSharedValue(0)

  const avatarTop = 80
  const nameTop = avatarTop + AVATAR_SIZE + 12
  const headerNameY = STATIC_TOP_INSET + 28

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet'
      scrollY.value = e.contentOffset.y
    },
  })

  const avatarStyle = useAnimatedStyle(() => {
    'worklet'
    const y = scrollY.value
    const opacity = interpolate(
      y,
      [0, SCROLL_RANGE],
      [1, 0],
      Extrapolation.CLAMP,
    )
    const translateY = interpolate(
      y,
      [0, SCROLL_RANGE],
      [0, -y],
      Extrapolation.CLAMP,
    )
    return {
      opacity,
      transform: [{ translateY }],
    }
  })

  const phoneStyle = useAnimatedStyle(() => {
    'worklet'
    const y = scrollY.value
    const opacity = interpolate(
      y,
      [0, SCROLL_RANGE],
      [1, 0],
      Extrapolation.CLAMP,
    )
    return {
      opacity,
      transform: [{ translateY: -y }],
    }
  })

  const nameCenterY = nameTop + 12

  const nameStyle = useAnimatedStyle(() => {
    'worklet'
    const y = scrollY.value
    const translateY = interpolate(
      y,
      [0, SCROLL_RANGE],
      [0, -(nameCenterY - headerNameY)],
      Extrapolation.CLAMP,
    )
    return {
      transform: [{ translateY }],
    }
  }, [])

  return (
    <View style={styles.container}>
      <AnimatedFlatList
        data={data}
        renderItem={renderItem as ListRenderItem<unknown>}
        keyExtractor={(item) => keyExtractor(item as T)}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: HEADER_HEIGHT + STATIC_TOP_INSET },
          contentContainerStyle,
        ]}
        ListFooterComponent={ListFooterComponent}
        showsVerticalScrollIndicator={false}
      />

      {/* Header: Avatar + Name + Phone, không nền */}
      <View
        style={[
          styles.headerOverlay,
          {
            height: HEADER_HEIGHT + STATIC_TOP_INSET,
            paddingTop: STATIC_TOP_INSET,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.profileBlock, { width: screenWidth }]}>
          <Animated.View
            style={[
              styles.avatarWrap,
              {
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                left: (screenWidth - AVATAR_SIZE) / 2,
                top: avatarTop,
              },
              avatarStyle,
            ]}
          >
            {avatarUri ? (
              <Image
                source={{
                  uri: avatarUri,
                  width: AVATAR_SIZE * 2,
                  height: AVATAR_SIZE * 2,
                }}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  { backgroundColor: 'rgba(0,0,0,0.08)' },
                ]}
              >
                <Text style={[styles.avatarFallbackText, { color: textColor }]}>
                  {initials}
                </Text>
              </View>
            )}
          </Animated.View>

          <Animated.View style={[styles.namePhoneWrap, { top: nameTop }]}>
            <Animated.Text
              style={[styles.nameText, nameStyle, { color: textColor }]}
              numberOfLines={1}
            >
              {name}
            </Animated.Text>
            <Animated.View style={phoneStyle}>
              <Text
                style={[styles.phoneText, { color: textMutedColor }]}
                numberOfLines={1}
              >
                {phone}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  profileBlock: {
    position: 'relative',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 40,
    fontWeight: '700',
  },
  namePhoneWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 16,
  },
})
