/**
 * Bottom sheet xác nhận cập nhật thông tin cá nhân — pattern giống ClearCartSheet.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { TouchableOpacity as GHTouchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

export type ConfirmUpdateProfileBottomSheetRef = {
  open: () => void
  close: () => void
}

type Props = {
  onConfirm: () => void
  isLoading?: boolean
}

const SNAP_POINTS = [220]

const ConfirmUpdateProfileBottomSheetBase = forwardRef<
  ConfirmUpdateProfileBottomSheetRef,
  Props
>(function ConfirmUpdateProfileBottomSheetBase({ onConfirm, isLoading = false }, ref) {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheetModal>(null)
  const [visible, setVisible] = useState(false)

  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => sheetRef.current?.dismiss(), [])

  useImperativeHandle(ref, () => ({ open, close }), [open, close])

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleConfirm = useCallback(() => {
    onConfirm()
  }, [onConfirm])

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

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? '#111827' : '#ffffff' }),
    [isDark],
  )
  const handleIndicator = useMemo(
    () => ({ backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }),
    [isDark],
  )

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      activeOffsetY={[-10, 10]}
      failOffsetX={[-5, 5]}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      handleIndicatorStyle={handleIndicator}
      onDismiss={() => setVisible(false)}
    >
          <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.body}>
              <Text style={[styles.title, { color: isDark ? '#F9FAFB' : '#111827' }]}>
                {t('profile.updateProfile')}
              </Text>
              <Text style={[styles.desc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {t('profile.confirmUpdateProfile')}
              </Text>
            </View>

            <View style={styles.btnRow}>
              <View style={styles.btnWrap}>
                <GHTouchable
                  onPress={isLoading ? undefined : close}
                  activeOpacity={0.8}
                  style={[styles.btn, { backgroundColor: isDark ? '#374151' : '#F3F4F6', opacity: isLoading ? 0.5 : 1 }]}
                >
                  <Text style={[styles.btnText, { color: isDark ? '#F9FAFB' : '#374151' }]}>
                    {tCommon('common.cancel', 'Huỷ')}
                  </Text>
                </GHTouchable>
              </View>
              <View style={styles.btnWrap}>
                <GHTouchable
                  onPress={isLoading ? undefined : handleConfirm}
                  activeOpacity={0.8}
                  style={[styles.btn, { backgroundColor: '#F7A737', opacity: isLoading ? 0.8 : 1 }]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.btnText, { color: '#ffffff' }]}>
                      {tCommon('common.confirm', 'Xác nhận')}
                    </Text>
                  )}
                </GHTouchable>
              </View>
            </View>
          </View>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  body: {
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 12,
  },
  btnWrap: {
    flex: 1,
  },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
})

export const ConfirmUpdateProfileBottomSheet = ConfirmUpdateProfileBottomSheetBase
