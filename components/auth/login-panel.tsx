import { Image } from 'expo-image'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity, View, useColorScheme } from 'react-native'

import { Images } from '@/assets/images'
import LoginForm from '@/components/auth/login-form'
import { Text } from '@/components/ui/text'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const LOGO_WIDTH = 120
const LOGO_HEIGHT = 32

export interface LoginPanelProps {
  /** Logo thương hiệu phía trên tiêu đề. Tắt trong bottom sheet vì không đủ chỗ. */
  showLogo?: boolean
  /** Sheet dùng tiêu đề nhỏ hơn vì đã có thanh kéo neo phía trên. */
  compactTitle?: boolean
  /** Link "Quay lại trang chủ" ở đáy. Tắt trong bottom sheet: sheet nổi trên
   *  màn khác nên đưa người dùng về trang chủ là sai ngữ cảnh. */
  showHomeLink?: boolean
  onLoginSuccess?: () => void
  onBeforeNavigate?: () => void
}

export default function LoginPanel({
  showLogo,
  compactTitle,
  showHomeLink = true,
  onLoginSuccess,
  onBeforeNavigate,
}: LoginPanelProps) {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  const handleRegister = useCallback(() => {
    onBeforeNavigate?.()
    // navigateWhenUnlocked: retry nếu navigation lock đang active (vd: một
    // transition khác chưa xong) thay vì silent drop như navigateNative.replace.
    navigateWhenUnlocked.replace('/auth/register')
  }, [onBeforeNavigate])

  const handleGoBackToHome = useCallback(() => {
    onBeforeNavigate?.()
    navigateWhenUnlocked.replace('/(tabs)/home')
  }, [onBeforeNavigate])

  return (
    <View className="flex-1 px-6 pt-6">
      {showLogo && (
        <Image
          testID="login-panel-logo"
          source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
          style={{
            width: LOGO_WIDTH,
            height: LOGO_HEIGHT,
            marginTop: 24,
          }}
          contentFit="contain"
          cachePolicy="memory"
        />
      )}

      <Text
        className={cn(
          'mt-6 font-sans-bold text-gray-900 dark:text-white',
          compactTitle ? 'text-2xl' : 'text-3xl',
        )}
      >
        {t('login.title')}
      </Text>
      <Text className="mt-2 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('login.description')}
      </Text>

      <View className="mt-7">
        <LoginForm
          onLoginSuccess={onLoginSuccess}
          onBeforeNavigate={onBeforeNavigate}
          onLoadingChange={setIsLoginLoading}
        />
      </View>

      <TouchableOpacity
        testID="login-panel-register"
        className="mt-6 items-center"
        onPress={handleRegister}
        disabled={isLoginLoading}
        hitSlop={8}
      >
        <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
          {t('login.noAccount')}{' '}
          <Text className="font-sans-semibold text-primary">
            {t('login.registerNow')}
          </Text>
        </Text>
      </TouchableOpacity>

      <View testID="login-panel-spacer" className="flex-1" />

      {showHomeLink && (
        <TouchableOpacity
          testID="login-panel-home"
          className="mb-10 mt-6 items-center"
          onPress={handleGoBackToHome}
          disabled={isLoginLoading}
          hitSlop={8}
        >
          <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
            {t('login.goBackToHome')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
