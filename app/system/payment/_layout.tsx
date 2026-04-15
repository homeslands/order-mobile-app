import { CustomStack, profileNativeStackScreenOptions } from '@/layouts/custom-stack'

/**
 * System Payment stack: màn thanh toán cho staff/admin
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function SystemPaymentLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
