import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useRef } from 'react'

import { LoginPanel } from '@/components/auth'
import { useLoginSheetStore } from '@/stores/login-sheet.store'
import { GlassSheetBackground } from '@/components/ui/glass-sheet-background'

const LOGIN_SHEET_SNAP = ['90%']

const LoginSheetPortalComponent = () => {
  const visible = useLoginSheetStore((s) => s.visible)
  const onSuccess = useLoginSheetStore((s) => s.onSuccess)
  const close = useLoginSheetStore((s) => s.close)
  const sheetRef = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleLoginSuccess = useCallback(() => {
    close()
    onSuccess?.()
  }, [close, onSuccess])

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
      backgroundComponent={GlassSheetBackground}
      onDismiss={close}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <LoginPanel
          compactTitle
          showHomeLink={false}
          onLoginSuccess={handleLoginSuccess}
          onBeforeNavigate={close}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

const LoginSheetPortal = memo(LoginSheetPortalComponent)
export default LoginSheetPortal
