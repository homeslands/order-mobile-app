import { Images } from '@/assets/images'
import { useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Redirect, useRouter } from 'expo-router'
import { X } from 'lucide-react-native'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'

import { LoginForm } from '@/components/auth'
import { ScreenContainer } from '@/components/layout'
import { Text } from '@/components/ui/text'
import { BannerPage, colors } from '@/constants'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { useMasterTransitionOptional } from '@/lib/navigation/master-transition-provider'
import { useAuthStore } from '@/stores'

const LOGO_WIDTH = 120
const LOGO_HEIGHT = 32

export default function LoginScreen() {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const iconColor = isDark ? colors.gray[200] : colors.gray[700]
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const hasHydrated = useAuthStore((state) => state._hasHydrated)
  const masterTransition = useMasterTransitionOptional()
  const queryClient = useQueryClient()
  const router = useRouter()

  const handleLoginSuccess = useCallback(() => {
    const homeCached = !!queryClient.getQueryData(['banners', BannerPage.HOME])
    const overlayMs = homeCached ? 100 : 250
    masterTransition?.showLoadingFor(overlayMs)
    // navigateWhenUnlocked: retry nếu navigation lock đang active (vd: bottom sheet
    // đang đóng khi user tap Login) thay vì silent drop như navigateNative.replace.
    navigateWhenUnlocked.replace('/(tabs)/home')
  }, [masterTransition, queryClient])

  // Login mở bằng cả push (gift-card, product detail, order detail) lẫn replace
  // (onboarding, register, forgot-password). Nút back thuần sẽ chết ở nhóm sau,
  // nên nút này luôn có đường thoát: back nếu có stack, không thì về trang chủ.
  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home')
  }, [router])

  const handleRegister = useCallback(() => {
    router.replace('/auth/register')
  }, [router])

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
          <View className="flex-1 px-6">
            <TouchableOpacity
              testID="login-close"
              onPress={handleClose}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full"
            >
              <X size={22} color={iconColor} />
            </TouchableOpacity>

            <Image
              source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
              style={{
                width: LOGO_WIDTH,
                height: LOGO_HEIGHT,
                marginTop: 24,
              }}
              contentFit="contain"
              cachePolicy="memory"
            />

            <Text className="mt-6 font-sans-bold text-3xl text-gray-900 dark:text-white">
              {t('login.title')}
            </Text>
            <Text className="mt-2 font-sans text-base text-gray-500 dark:text-gray-400">
              {t('login.description')}
            </Text>

            <View className="mt-7">
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </View>

            <View className="flex-1" />

            <TouchableOpacity
              className="mt-6 items-center"
              onPress={handleRegister}
              hitSlop={8}
            >
              <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
                {t('login.noAccount')}{' '}
                <Text className="font-sans-semibold text-primary">
                  {t('login.registerNow')}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
