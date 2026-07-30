import { useQueryClient } from '@tanstack/react-query'
import { Redirect } from 'expo-router'
import { useCallback } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native'

import { LoginPanel } from '@/components/auth'
import { ScreenContainer } from '@/components/layout'
import { BannerPage, colors } from '@/constants'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { useMasterTransitionOptional } from '@/lib/navigation/master-transition-provider'
import { useAuthStore } from '@/stores'

export default function LoginScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const hasHydrated = useAuthStore((state) => state._hasHydrated)
  const masterTransition = useMasterTransitionOptional()
  const queryClient = useQueryClient()

  const handleLoginSuccess = useCallback(() => {
    const homeCached = !!queryClient.getQueryData(['banners', BannerPage.HOME])
    const overlayMs = homeCached ? 100 : 250
    masterTransition?.showLoadingFor(overlayMs)
    // navigateWhenUnlocked: retry nếu navigation lock đang active (vd: bottom sheet
    // đang đóng khi user tap Login) thay vì silent drop như navigateNative.replace.
    navigateWhenUnlocked.replace('/(tabs)/home')
  }, [masterTransition, queryClient])

  if (!hasHydrated) {
    return null // render nothing while store hydrates (50–200ms)
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />
  }

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      className="flex-1"
      style={{ backgroundColor: bgColor }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android đã ở adjustResize mặc định của Expo — dùng thêm
        // behavior="height" sẽ xử lý hai lần và gây giật layout.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ backgroundColor: bgColor }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LoginPanel showLogo onLoginSuccess={handleLoginSuccess} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
