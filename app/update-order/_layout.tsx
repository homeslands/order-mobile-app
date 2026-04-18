import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

/**
 * Update Order stack: màn cập nhật đơn hàng /update-order/[slug]
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function UpdateOrderLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
