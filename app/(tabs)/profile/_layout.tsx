/**
 * Profile placeholder: Native Stack — slide_from_right + hãm phanh chuẩn native.
 *
 * screenOptions:
 * - animation: 'slide_from_right' — tùy chỉnh animationDuration: 420ms (pha cuối chậm hơn)
 * - fullScreenGestureEnabled: true — vuốt đóng có quán tính hãm phanh đồng bộ
 * - headerShown: false — màn tự custom header; set true nếu cần header native trượt theo nội dung
 */
import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

export default function ProfilePlaceholderLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
