import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

/**
 * Menu stack: chi tiết món /menu/[slug], product-rating, ...
 * Native Stack: slide_from_right + spring deceleration (hãm phanh).
 * Flow: Menu → tap product → router.push → Native Stack push → Product Detail.
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function MenuLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
