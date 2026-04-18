/**
 * PointConfirmDialog — confirmation dialog for point-balance payment.
 * Extracted from app/payment/[order].tsx to isolate inline JSX + styles.
 *
 * Memo'd: parent re-renders (order refetch, focus effects) do not re-render this
 * modal as long as its props are stable.
 */
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { LightweightDialog } from '@/components/ui/lightweight-dialog'
import { colors } from '@/constants'
import { formatCurrency } from '@/utils'

type Props = {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  orderSubtotal: number
  coinBalance: number
  primaryColor: string
  isDark: boolean
}

export const PointConfirmDialog = memo(function PointConfirmDialog({
  visible,
  onClose,
  onConfirm,
  orderSubtotal,
  coinBalance,
  primaryColor,
  isDark,
}: Props) {
  const { t } = useTranslation('menu')

  // Stable theme-dependent style objects
  const theme = useMemo(
    () => ({
      card: {
        backgroundColor: isDark ? colors.gray[800] : colors.white.light,
      },
      title: { color: isDark ? colors.gray[50] : colors.gray[900] },
      label: { color: isDark ? colors.gray[400] : colors.gray[500] },
      value: { color: isDark ? colors.gray[50] : colors.gray[900] },
      deduct: {
        color: isDark ? colors.destructive.dark : colors.destructive.light,
      },
      divider: {
        backgroundColor: isDark ? colors.gray[700] : colors.gray[200],
      },
      cancelBtn: {
        backgroundColor: isDark ? colors.gray[700] : colors.gray[100],
      },
      cancelText: { color: isDark ? colors.gray[200] : colors.gray[700] },
    }),
    [isDark],
  )

  if (!visible) return null

  return (
    <LightweightDialog visible={visible} onClose={onClose}>
      {(dismiss) => (
        <View style={[s.card, theme.card]}>
          <Text style={[s.title, theme.title]}>
            {t(
              'paymentMethod.confirmPointPaymentTitle',
              'Xác nhận thanh toán bằng xu',
            )}
          </Text>
          <View style={s.body}>
            <View style={s.row}>
              <Text style={[s.label, theme.label]}>
                {t('paymentMethod.currentBalance', 'Số dư hiện tại')}
              </Text>
              <Text style={[s.value, theme.value]}>
                {formatCurrency(coinBalance, '')} xu
              </Text>
            </View>
            <View style={s.row}>
              <Text style={[s.label, theme.label]}>
                {t('paymentMethod.deductAmount', 'Số xu thanh toán')}
              </Text>
              <Text style={[s.value, theme.deduct]}>
                -{formatCurrency(orderSubtotal, '')} xu
              </Text>
            </View>
            <View style={[s.divider, theme.divider]} />
            <View style={s.row}>
              <Text style={[s.label, theme.label, s.bold]}>
                {t('paymentMethod.balanceAfter', 'Số dư sau thanh toán')}
              </Text>
              <Text
                style={[s.value, { color: primaryColor, fontWeight: '700' }]}
              >
                {formatCurrency(coinBalance - orderSubtotal, '')} xu
              </Text>
            </View>
          </View>
          <View style={s.actions}>
            <Pressable onPress={dismiss} style={[s.btn, theme.cancelBtn]}>
              <Text style={[s.btnText, theme.cancelText]}>
                {t('common:common.cancel', 'Hủy')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[s.btn, { backgroundColor: primaryColor, flex: 1 }]}
            >
              <Text style={[s.btnText, { color: colors.white.light }]}>
                {t('paymentMethod.confirmPayment', 'Thanh toán')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </LightweightDialog>
  )
})

const s = StyleSheet.create({
  card: { width: '100%', borderRadius: 16, padding: 24, gap: 20 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  body: { gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600' },
  bold: { fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: 12 },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flex: 1,
  },
  btnText: { fontSize: 15, fontWeight: '600' },
})
