/**
 * PaymentSummaryCard — receipt-style payment breakdown for the payment page.
 * Shows payment method, status, transaction id, price breakdown (subtotal,
 * promotion, voucher, loyalty points, delivery fee, auto-loss), grand total,
 * and coin-paid note.
 *
 * Read-only + React.memo'd: parent re-renders (polling, focus effects) do not
 * cascade unless order / cartTotals / coinBalance actually change.
 */
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { colors, PaymentMethod } from '@/constants'
import type { useOrderBySlug } from '@/hooks'
import type { CartTotals } from '@/stores/cart-display.store'
import { OrderStatus, OrderTypeEnum } from '@/types'
import { formatCurrency, getPaymentStatusLabel } from '@/utils'

type Order = NonNullable<ReturnType<typeof useOrderBySlug>['data']>['result']

type Props = {
  order: Order
  cartTotals: CartTotals | null
  coinBalance: number
  primaryColor: string
  isDark: boolean
}

export const PaymentSummaryCard = memo(function PaymentSummaryCard({
  order,
  cartTotals,
  coinBalance,
  primaryColor,
  isDark,
}: Props) {
  const { t } = useTranslation('menu')

  const theme = useMemo(
    () => ({
      card: {
        backgroundColor: isDark ? colors.gray[800] : colors.white.light,
        borderColor: isDark ? colors.gray[700] : colors.gray[100],
      },
      divider: { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] },
      dividerStrong: {
        backgroundColor: isDark ? colors.gray[700] : colors.gray[200],
      },
      title: { color: isDark ? colors.gray[50] : colors.gray[900] },
      subtle: { color: isDark ? colors.gray[400] : colors.gray[500] },
      value: { color: isDark ? colors.gray[50] : colors.gray[900] },
    }),
    [isDark],
  )

  const paymentMethodLabel = order.payment
    ? order.payment.paymentMethod === PaymentMethod.BANK_TRANSFER
      ? t('paymentMethod.bankTransfer', 'Chuyển khoản')
      : order.payment.paymentMethod === PaymentMethod.CASH
        ? t('paymentMethod.cash', 'Tiền mặt')
        : order.payment.paymentMethod === PaymentMethod.POINT
          ? t('paymentMethod.point', 'Điểm tích lũy')
          : t('paymentMethod.creditCard', 'Thẻ tín dụng')
    : t('paymentMethod.notPaid', 'Chưa thanh toán')

  const promotionDiscount = cartTotals?.promotionDiscount ?? 0
  const voucherDiscount = cartTotals?.voucherDiscount ?? 0
  const subTotalBeforeDiscount = cartTotals?.subTotalBeforeDiscount ?? 0
  const itemCount = order.orderItems?.length || 0
  const showCoinPaidNote =
    order.payment?.paymentMethod === PaymentMethod.POINT &&
    order.status === OrderStatus.PAID

  return (
    <View style={[s.card, theme.card]}>
      <View style={s.header}>
        <Text style={[s.title, theme.title]}>
          {t('order.paymentInformation', 'Thông tin thanh toán')}
        </Text>
      </View>
      <View style={[s.divider, theme.divider]} />
      <View style={s.body}>
        <View style={s.row}>
          <Text style={[s.label, theme.subtle]}>
            {t('paymentMethod.title', 'Phương thức')}
          </Text>
          <Text style={[s.value, theme.value]}>{paymentMethodLabel}</Text>
        </View>
        {order.payment && (
          <View style={s.row}>
            <Text style={[s.label, theme.subtle]}>
              {t('order.status', 'Trạng thái')}
            </Text>
            <View
              style={[
                s.statusBadge,
                {
                  backgroundColor:
                    order.payment.statusMessage === OrderStatus.COMPLETED
                      ? colors.success.light
                      : colors.warning.light,
                },
              ]}
            >
              <Text
                style={[s.statusBadgeText, { color: colors.white.light }]}
                numberOfLines={1}
              >
                {getPaymentStatusLabel(order.payment.statusCode)}
              </Text>
            </View>
          </View>
        )}
        {order.payment?.paymentMethod === PaymentMethod.CREDIT_CARD &&
          order.payment.transactionId && (
            <View style={s.row}>
              <Text style={[s.label, theme.subtle]}>
                {t('paymentMethod.transactionId', 'Mã giao dịch')}
              </Text>
              <Text style={[s.value, theme.value]}>
                {order.payment.transactionId}
              </Text>
            </View>
          )}

        <View style={[s.divider, theme.divider, { marginHorizontal: 0 }]} />

        {/* Price breakdown */}
        <View style={s.row}>
          <Text style={[s.label, theme.subtle]}>
            {t('order.subTotal', 'Tổng tiền hàng')}
          </Text>
          <Text style={[s.value, theme.value]}>
            {formatCurrency(subTotalBeforeDiscount)}
          </Text>
        </View>
        {promotionDiscount > 0 && (
          <View style={s.row}>
            <Text style={[s.label, theme.subtle]}>
              {t('order.discount', 'Khuyến mãi')}
            </Text>
            <Text style={[s.value, { color: colors.success.light }]}>
              -{formatCurrency(promotionDiscount)}
            </Text>
          </View>
        )}
        {order.voucher && voucherDiscount > 0 && (
          <View style={s.row}>
            <Text style={[s.label, { color: colors.success.light }]}>
              {t('order.voucher', 'Mã giảm giá')}
            </Text>
            <Text style={[s.value, { color: colors.success.light }]}>
              -{formatCurrency(voucherDiscount)}
            </Text>
          </View>
        )}
        {order.accumulatedPointsToUse > 0 && (
          <View style={s.row}>
            <Text style={[s.label, { color: primaryColor }]}>
              {t('order.loyaltyPoint', 'Điểm tích lũy')}
            </Text>
            <Text style={[s.value, { color: primaryColor }]}>
              -{formatCurrency(order.accumulatedPointsToUse)}
            </Text>
          </View>
        )}
        {order.type === OrderTypeEnum.DELIVERY && order.deliveryFee > 0 && (
          <View style={s.row}>
            <Text style={[s.label, theme.subtle]}>
              {t('order.deliveryFee', 'Phí giao hàng')}
            </Text>
            <Text style={[s.value, theme.value]}>
              {formatCurrency(order.deliveryFee)}
            </Text>
          </View>
        )}
        {order.loss > 0 && (
          <View style={s.row}>
            <Text style={[s.label, { color: colors.success.light }]}>
              {t(
                'order.invoiceAutoDiscountUnderThreshold',
                'Giảm giá tự động',
              )}
            </Text>
            <Text style={[s.value, { color: colors.success.light }]}>
              -{formatCurrency(order.loss)}
            </Text>
          </View>
        )}

        <View style={[s.divider, theme.dividerStrong, { marginHorizontal: 0 }]} />

        {/* Total */}
        <View style={s.row}>
          <Text style={[s.totalLabel, theme.title]}>
            {t('order.totalPayment', 'Tổng thanh toán')}
          </Text>
          <Text style={[s.totalPrice, { color: primaryColor }]}>
            {formatCurrency(order.subtotal || 0)}
          </Text>
        </View>
        <Text style={[s.xsText, theme.subtle]}>
          ({itemCount} {t('order.product', 'sản phẩm')})
        </Text>
        {showCoinPaidNote && (
          <View
            style={[
              s.coinPaidNote,
              {
                backgroundColor: isDark
                  ? `${primaryColor}18`
                  : `${primaryColor}08`,
                borderColor: isDark
                  ? `${primaryColor}40`
                  : `${primaryColor}20`,
              },
            ]}
          >
            <Text style={[s.xsText, { color: primaryColor, fontWeight: '500' }]}>
              {t('paymentMethod.paidWithCoin', 'Đã thanh toán {{amount}} xu', {
                amount: formatCurrency(order.subtotal || 0, ''),
              })}
            </Text>
            {coinBalance > 0 && (
              <Text style={[s.xsText, theme.subtle]}>
                {t('paymentMethod.currentBalance', 'Số dư hiện tại')}:{' '}
                {formatCurrency(coinBalance, '')} xu
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  card: { marginBottom: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  header: { padding: 16, gap: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  totalLabel: { fontSize: 16, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  body: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '500' },
  xsText: { fontSize: 12 },
  totalPrice: { fontSize: 24, fontWeight: '800' },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '500' },
  coinPaidNote: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
})
