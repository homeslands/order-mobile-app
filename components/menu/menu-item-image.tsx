import { Image } from 'expo-image'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Images } from '@/assets/images'

type MenuItemImageProps = {
  id: string
  imageUrl: string | null
  isEnabled?: boolean
  transitionMs?: number
  priority: 'high' | 'normal'
  borderRadius?: number
}

const MENU_ITEM_BLURHASH = '|rF?hV%2WCj[ayj[a}ayfQfQfQfQj[j[fQfQfQfQfQfQfQfQfQ'

function MenuItemImageBase({
  id,
  imageUrl,
  isEnabled = true,
  transitionMs = 0,
  priority,
  borderRadius,
}: MenuItemImageProps) {
  // Phase gate chưa ready — giữ View trống để tránh decode storm khi enter tab
  if (!isEnabled) {
    return <View className="bg-gray-100 dark:bg-gray-700" style={[styles.placeholder, borderRadius != null ? { borderRadius } : null]} />
  }

  // Không có URL — dùng ảnh mặc định
  if (!imageUrl) {
    return (
      <Image
        source={Images.Food.DefaultProductImage}
        style={[styles.image, borderRadius != null ? { borderRadius } : null]}
        contentFit="cover"
      />
    )
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.image, borderRadius != null ? { borderRadius } : null]}
      contentFit="cover"
      transition={transitionMs}
      placeholder={MENU_ITEM_BLURHASH}
      recyclingKey={id}
      cachePolicy="memory-disk"
      decodeFormat="rgb"
      priority={priority}
      allowDownscaling
      enforceEarlyResizing
    />
  )
}

function areEqual(prev: MenuItemImageProps, next: MenuItemImageProps) {
  return (
    prev.id === next.id &&
    prev.imageUrl === next.imageUrl &&
    prev.isEnabled === next.isEnabled &&
    prev.transitionMs === next.transitionMs &&
    prev.priority === next.priority &&
    prev.borderRadius === next.borderRadius
  )
}

export const MenuItemImage = React.memo(MenuItemImageBase, areEqual)

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
  },
})
