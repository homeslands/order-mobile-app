import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { TriangleAlert } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'

interface VoucherConflictBottomSheetProps {
  visible: boolean
  voucherCode: string
  paymentMethodLabel: string
  isDark: boolean
  primaryColor: string
  isRemoving: boolean
  onKeepVoucher: () => void
  onRemoveVoucher: () => void
}

const SNAP_POINTS = ['42%']

const VoucherConflictBottomSheet = memo(function VoucherConflictBottomSheet({
  visible,
  voucherCode,
  paymentMethodLabel,
  isDark,
  primaryColor,
  isRemoving,
  onKeepVoucher,
  onRemoveVoucher,
}: VoucherConflictBottomSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom: bottomInset } = useSafeAreaInsets()
  const { t } = useTranslation('payment')

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [visible])

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
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  )

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]

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
      onDismiss={onKeepVoucher}
    >
      <View style={s.sheetInner}>
        {/* Content */}
        <View style={s.content}>
          {/* Icon + Title */}
          <View style={s.iconRow}>
            <View
              style={[
                s.iconWrap,
                { backgroundColor: `${colors.warning.light}18` },
              ]}
            >
              <TriangleAlert size={24} color={colors.warning.light} />
            </View>
            <Text style={[s.title, { color: textColor }]}>
              {t('voucherConflict.title')}
            </Text>
          </View>

          {/* Description */}
          <Text style={[s.desc, { color: subColor }]}>
            {t('voucherConflict.descPrefix')}{' '}
            <Text style={[s.bold, { color: textColor }]}>"{voucherCode}"</Text>{' '}
            {t('voucherConflict.descNotSupport')}{' '}
            <Text style={[s.bold, { color: textColor }]}>
              "{paymentMethodLabel}"
            </Text>
            .{'\n'}
            {t('voucherConflict.descSuffix')}
          </Text>
        </View>

        {/* Footer — pinned to bottom */}
        <View
          style={[
            s.footer,
            { borderTopColor: borderColor, paddingBottom: bottomInset + 12 },
          ]}
        >
          <Pressable
            onPress={onKeepVoucher}
            disabled={isRemoving}
            style={[
              s.keepBtn,
              { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] },
            ]}
          >
            <Text style={[s.keepBtnText, { color: textColor }]}>
              {t('voucherConflict.keepVoucher')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onRemoveVoucher}
            disabled={isRemoving}
            style={[
              s.removeBtn,
              { backgroundColor: primaryColor, opacity: isRemoving ? 0.7 : 1 },
            ]}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={colors.white.light} />
            ) : (
              <Text style={s.removeBtnText}>
                {t('voucherConflict.removeAndContinue')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  )
})

export default VoucherConflictBottomSheet

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
  bold: {
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keepBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white.light,
    textAlign: 'center',
  },
})
