import { Image } from 'expo-image'
import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Images } from '@/assets/images'
import { useThumbnailUri } from '@/hooks/use-thumbnail-uri'
import { invalidateThumbnail } from '@/lib/image/thumbnail-cache'
import { IMAGE_PRESET } from '@/utils/product-image-url'

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
  // Resolve to an on-device 384px thumbnail (small GPU texture → smooth scroll).
  // Hook must run before the early returns; only active for real remote urls.
  const thumb = useThumbnailUri(
    isEnabled && imageUrl ? imageUrl : null,
    IMAGE_PRESET.THUMB,
  )

  // If a cached thumbnail file is gone (OS purged the cache dir), the local uri
  // is dead → fall back to the original remote url for THIS cell (keyed by url,
  // so a recycled cell showing a different product resets automatically).
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  // Phase gate chưa ready — giữ View trống để tránh decode storm khi enter tab
  if (!isEnabled) {
    return (
      <View
        className="bg-gray-100 dark:bg-[#2e2e2e]"
        style={[
          styles.placeholder,
          borderRadius != null ? { borderRadius } : null,
        ]}
      />
    )
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
      source={
        failedUrl === imageUrl && imageUrl
          ? { uri: imageUrl }
          : thumb
            ? { uri: thumb }
            : null
      }
      onError={() => {
        if (imageUrl) {
          invalidateThumbnail(imageUrl, IMAGE_PRESET.THUMB)
          setFailedUrl(imageUrl)
        }
      }}
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
