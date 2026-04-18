import { Appearance } from 'react-native'
import {
  CustomStack,
  profileNativeStackScreenOptions,
} from '@/layouts/custom-stack'
import { colors } from '@/constants'

// Auth screens use white/gray-900, not the app background tokens.
// Compute once at module load — same pattern as profileNativeStackScreenOptions._isDark.
const _authIsDark = Appearance.getColorScheme() === 'dark'

/**
 * Auth stack: login, register, forgot-password, ...
 * Uses CustomStack with withLayoutContext for proper expo-router integration
 * (avoids nested independent Stack instances that cause infinite updates)
 */
export default function AuthLayout() {
  return (
    <CustomStack
      screenOptions={{
        ...profileNativeStackScreenOptions,
        contentStyle: {
          backgroundColor: _authIsDark ? colors.gray[900] : '#ffffff',
        },
      }}
    />
  )
}
