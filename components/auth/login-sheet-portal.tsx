import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity, View, useColorScheme } from 'react-native'

import LoginForm from '@/components/auth/login-form'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { useLoginSheetStore } from '@/stores/login-sheet.store'

const LOGIN_SHEET_SNAP = ['90%']

const LoginSheetPortalComponent = () => {
  const visible = useLoginSheetStore((s) => s.visible)
  const onSuccess = useLoginSheetStore((s) => s.onSuccess)
  const close = useLoginSheetStore((s) => s.close)
  const sheetRef = useRef<BottomSheetModal>(null)
  const isDark = useColorScheme() === 'dark'

  const { t } = useTranslation('auth')

  const handleRegister = useCallback(() => {
    close()
    // navigateWhenUnlocked: retry nếu navigation lock đang active (khi sheet
    // đang đóng) thay vì silent drop như navigateNative.replace.
    navigateWhenUnlocked.replace('/auth/register')
  }, [close])

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleLoginSuccess = useCallback(() => {
    close()
    onSuccess?.()
  }, [close, onSuccess])

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.card.dark : colors.white.light }),
    [isDark],
  )

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  )

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={LOGIN_SHEET_SNAP}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={close}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-6 pt-2">
          <Text className="font-sans-bold text-2xl text-gray-900 dark:text-white">
            {t('login.title')}
          </Text>
          <Text className="mt-2 font-sans text-base text-gray-500 dark:text-gray-400">
            {t('login.description')}
          </Text>

          <View className="mt-7">
            <LoginForm
              onLoginSuccess={handleLoginSuccess}
              onBeforeNavigate={close}
            />
          </View>

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
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

const LoginSheetPortal = memo(LoginSheetPortalComponent)
export default LoginSheetPortal
