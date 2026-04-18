import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

/**
 * Menu Detail stack — /(tabs)/menu-detail/[slug].
 * slide_from_right + hãm phanh (380ms, fullScreenGestureEnabled) — giống Profile.
 */
export default function MenuDetailLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
