import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { TriangleAlert } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'

const SNAP_POINTS = ['38%']

interface ChangePhoneConfirmSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

function ChangePhoneConfirmSheetComponent({
  isOpen,
  onOpenChange,
  onConfirm,
}: ChangePhoneConfirmSheetProps) {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

  const sheetRef = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleConfirm = useCallback(() => {
    onConfirm()
    onOpenChange(false)
  }, [onConfirm, onOpenChange])

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
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  )

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const destructiveColor = isDark
    ? colors.destructive.dark
    : colors.destructive.light

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      handleIndicatorStyle={{
        backgroundColor: isDark ? colors.gray[600] : colors.gray[300],
      }}
      onDismiss={handleClose}
    >
      <View style={s.sheetInner}>
        <View style={s.content}>
          <View style={s.iconRow}>
            <View style={s.iconWrap}>
              <TriangleAlert size={24} color={destructiveColor} />
            </View>
            <Text style={[s.title, { color: textColor }]}>
              {t('register.changePhoneTitle')}
            </Text>
          </View>

          <Text style={[s.desc, { color: subColor }]}>
            {t('register.changePhoneMessage')}
          </Text>
        </View>

        <View
          style={[
            s.footer,
            { borderTopColor: borderColor, paddingBottom: bottomInset + 12 },
          ]}
        >
          <Pressable
            onPress={handleClose}
            style={[
              s.cancelBtn,
              {
                backgroundColor: isDark
                  ? colors.border.dark
                  : colors.gray[100],
              },
            ]}
          >
            <Text style={[s.cancelBtnText, { color: textColor }]}>
              {tCommon('cancel')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            style={[s.confirmBtn, { backgroundColor: destructiveColor }]}
          >
            <Text style={s.confirmBtnText}>
              {t('register.changePhoneConfirm')}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  )
}

export const ChangePhoneConfirmSheet = ChangePhoneConfirmSheetComponent

const s = StyleSheet.create({
  sheetInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  desc: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white.light,
  },
})
