/**
 * Nguồn ảnh mặc định khi món không có ảnh.
 * Dùng URI (từ resolveAssetSource) để expo-image hiển thị ổn định trên mọi nền tảng.
 */
// eslint-disable-next-line no-restricted-imports -- Image.resolveAssetSource is a static utility, not a UI component
import { Image } from 'react-native'

import { Images } from '@/assets/images'

const resolved = Image.resolveAssetSource(
  Images.Food.DefaultProductImage as number,
)?.uri

/** URI ảnh mặc định, hoặc null nếu không resolve được */
export const DEFAULT_PRODUCT_IMAGE_URI: string | null = resolved ?? null

/** source cho expo-image: ưu tiên URI, fallback sang asset number */
export const DEFAULT_PRODUCT_IMAGE_SOURCE = DEFAULT_PRODUCT_IMAGE_URI
  ? { uri: DEFAULT_PRODUCT_IMAGE_URI }
  : (Images.Food.DefaultProductImage as number)
