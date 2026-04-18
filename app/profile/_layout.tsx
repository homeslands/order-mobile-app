import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

/**
 * Profile: Native Stack — slide_from_right + hãm phanh chuẩn native.
 * fullScreenGestureEnabled: true, animationDuration: 420ms (pha cuối chậm).
 */
export default function ProfileLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
