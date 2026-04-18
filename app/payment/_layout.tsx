import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'

/**
 * Payment stack: màn thanh toán /payment/[order]
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function PaymentLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
