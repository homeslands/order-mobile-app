import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useColorScheme } from 'react-native'

import LoginForm from '@/components/auth/login-form'
import { colors } from '@/constants'
import { useLoginSheetStore } from '@/stores/login-sheet.store'

const LOGIN_SHEET_SNAP = ['90%']

const LoginSheetPortalComponent = () => {
  const visible = useLoginSheetStore((s) => s.visible)
  const onSuccess = useLoginSheetStore((s) => s.onSuccess)
  const close = useLoginSheetStore((s) => s.close)
  const sheetRef = useRef<BottomSheetModal>(null)
  const isDark = useColorScheme() === 'dark'

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
        <LoginForm onLoginSuccess={handleLoginSuccess} onBeforeNavigate={close} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

const LoginSheetPortal = memo(LoginSheetPortalComponent)
export default LoginSheetPortal
