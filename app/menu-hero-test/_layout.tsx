import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

/**
 * Test stack cho Hero Transition trên Native Stack (UI thread).
 * Dùng simple_push 2D slide + brake 260ms giống flow thật.
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function MenuHeroTestLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
