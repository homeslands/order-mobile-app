import { Redirect } from 'expo-router'
import React, { useCallback } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'

import { useQueryClient } from '@tanstack/react-query'
import { LoginForm } from '@/components/auth'
import { BannerPage } from '@/constants'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { useMasterTransitionOptional } from '@/lib/navigation/master-transition-provider'
import { useAuthStore } from '@/stores'

export default function LoginScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.gray[900] : '#ffffff'
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
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

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />
  }

  return (
    <ScreenContainer
      edges={['top']}
      className="flex-1"
      style={{ backgroundColor: bgColor }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ backgroundColor: bgColor }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
