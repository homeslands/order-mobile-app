/**
 * Logout sheet — BottomSheetModal pattern.
 * Store-driven: visible từ useLogoutSheetStore.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { useLogoutSheetStore } from '@/stores/logout-sheet.store'

const LOGOUT_SHEET_SNAP = ['30%']

const LogoutSheetPortal = () => {
  const { visible, onConfirm, close } = useLogoutSheetStore()
  const sheetRef = useRef<BottomSheetModal>(null)
  const isDark = useColorScheme() === 'dark'

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleConfirm = useCallback(() => {
    sheetRef.current?.dismiss()
    onConfirm?.()
  }, [onConfirm])

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
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
      snapPoints={LOGOUT_SHEET_SNAP}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={close}
    >
      <LogoutSheetContent
        onCancel={() => sheetRef.current?.dismiss()}
        onConfirm={handleConfirm}
        isDark={isDark}
      />
    </BottomSheetModal>
  )
}

const LogoutSheetContent = memo(function LogoutSheetContent({
  onCancel,
  onConfirm,
  isDark,
}: {
  onCancel: () => void
  onConfirm: () => void
  isDark: boolean
}) {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const { bottom: bottomInset } = useSafeAreaInsets()

  return (
    <View style={[s.content, { paddingBottom: bottomInset + 8 }]}>
      <Text style={[s.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
        {t('logout.title', 'Đăng xuất')}
      </Text>
      <Text style={[s.description, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
        {t('logout.description', 'Bạn có chắc chắn muốn đăng xuất không?')}
      </Text>

      <View style={s.spacer} />

      <View style={s.footer}>
        <Pressable
          onPress={onCancel}
          style={[s.cancelBtn, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}
        >
          <Text style={[s.cancelText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>
            {tCommon('common.cancel', 'Huỷ')}
          </Text>
        </Pressable>

        <Pressable onPress={onConfirm} style={s.confirmBtn}>
          <Text style={s.confirmText}>
            {t('logout.logout', 'Đăng xuất')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
})

export default LogoutSheetPortal
