import { CustomStack, profileNativeStackScreenOptions } from '@/layouts/custom-stack'

/**
 * Auth stack: login, register, forgot-password, ...
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function AuthLayout() {
  return <CustomStack screenOptions={profileNativeStackScreenOptions} />
}
