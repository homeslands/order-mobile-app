import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

/**
 * Home stack: tin tức /home/news/[slug], ...
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function HomeLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
