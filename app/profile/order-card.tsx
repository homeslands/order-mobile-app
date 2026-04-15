import React, { memo, useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants'
import type { IOrder } from '@/types'
import { OrderTypeEnum } from '@/types'
import {
  capitalizeFirstLetter,
  formatCurrency,
  formatDateTime,
} from '@/utils'

import OrderProductItem, {
  getStatusBadgeColors,
  type OrderDisplayData,
} from './order-product-item'

// Re-export shared types for consumers
export { getStatusBadgeColors } from './order-product-item'
export type { OrderDisplayData } from './order-product-item'

// ─── OrderCard (memo'd) ─────────────────────────────────────────────────────

const OrderCard = memo(function OrderCard({
  order,
  displayData,
  primaryColor,
  isDark,
  statusLabel,
  onPress,
  labels,
}: {
  order: IOrder
  displayData: OrderDisplayData | null
  primaryColor: string
  isDark: boolean
  statusLabel: string
  onPress: (slug: string) => void
  labels: {
    subtotal: string
    promotionDiscount: string
    voucher: string
    loyaltyPoint: string
    deliveryFee: string
    totalPayment: string
    moreItems: string
  }
}) {
  const orderItems = order.orderItems || []
  const voucher = order.voucher || null
  const cartTotals = displayData?.cartTotals ?? null
  const statusColors = getStatusBadgeColors(order.payment?.statusCode)

  const handlePress = useCallback(
    () => onPress(order.slug),
    [order.slug, onPress],
  )

  return (
    <Pressable
      onPress={handlePress}
style={[
        cardStyles.card,
        {
          backgroundColor: isDark ? colors.gray[800] : colors.white.light,
        },
      ]}
    >
      {/* Header */}
      <View style={[cardStyles.cardHeader, { backgroundColor: `${primaryColor}15`, borderBottomColor: `${primaryColor}30` }]}>
        <Text style={[cardStyles.dateText, { color: isDark ? colors.gray[400] : colors.gray[600] }]}>
          {formatDateTime(order.createdAt)}
        </Text>
        <View style={[cardStyles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[cardStyles.statusText, { color: statusColors.text }]}>
            {capitalizeFirstLetter(statusLabel)}
          </Text>
        </View>
      </View>

      {/* Products */}
      <View style={cardStyles.body}>
        {orderItems.slice(0, 3).map((product, index) => (
          <OrderProductItem
            key={product.slug || index}
            product={product}
            displayData={displayData}
            voucher={voucher}
            primaryColor={primaryColor}
            isDark={isDark}
            isLast={index === Math.min(orderItems.length - 1, 2)}
          />
        ))}

        {orderItems.length > 3 && (
          <Text style={[cardStyles.moreText, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
            +{orderItems.length - 3} {labels.moreItems}
          </Text>
        )}

        {/* Summary */}
        <View style={[cardStyles.summarySection, { borderTopColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
          {cartTotals && (
            <>
              <View style={cardStyles.summaryRow}>
                <Text style={[cardStyles.summaryLabel, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>{labels.subtotal}</Text>
                <Text style={[cardStyles.summaryValue, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>{formatCurrency(cartTotals.subTotalBeforeDiscount)}</Text>
              </View>
              {(cartTotals.promotionDiscount ?? 0) > 0 && (
                <View style={cardStyles.summaryRow}>
                  <Text style={[cardStyles.summaryLabelMuted, { color: isDark ? colors.gray[600] : colors.gray[600] }]}>{labels.promotionDiscount}</Text>
                  <Text style={[cardStyles.summaryValueMuted, { color: colors.gray[400] }]}>
                    -{formatCurrency(cartTotals.promotionDiscount)}
                  </Text>
                </View>
              )}
              {(cartTotals.voucherDiscount ?? 0) > 0 && (
                <View style={cardStyles.summaryRow}>
                  <Text style={[cardStyles.summaryLabelMuted, { color: colors.success.light }]}>{labels.voucher}</Text>
                  <Text style={[cardStyles.summaryValueMuted, { color: primaryColor }]}>
                    -{formatCurrency(cartTotals.voucherDiscount)}
                  </Text>
                </View>
              )}
            </>
          )}
          {(order.accumulatedPointsToUse ?? 0) > 0 && (
            <View style={cardStyles.summaryRow}>
              <Text style={[cardStyles.summaryLabelMuted, { color: primaryColor }]}>{labels.loyaltyPoint}</Text>
              <Text style={[cardStyles.summaryValueMuted, { color: primaryColor }]}>
                -{formatCurrency(order.accumulatedPointsToUse)}
              </Text>
            </View>
          )}
          {order.type === OrderTypeEnum.DELIVERY && order.deliveryFee > 0 && (
            <View style={cardStyles.summaryRow}>
              <Text style={[cardStyles.summaryLabelMuted, { color: colors.gray[400] }]}>{labels.deliveryFee}</Text>
              <Text style={[cardStyles.summaryValueMuted, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>{formatCurrency(order.deliveryFee)}</Text>
            </View>
          )}
          <View style={[cardStyles.totalRow, { borderTopColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
            <Text style={[cardStyles.totalLabel, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>{labels.totalPayment}</Text>
            <Text style={[cardStyles.totalValue, { color: primaryColor }]}>{formatCurrency(order.subtotal || 0)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}, (prev, next) =>
  prev.order.slug === next.order.slug &&
  prev.order.status === next.order.status &&
  prev.order.subtotal === next.order.subtotal &&
  prev.displayData === next.displayData &&
  prev.primaryColor === next.primaryColor &&
  prev.isDark === next.isDark &&
  prev.statusLabel === next.statusLabel &&
  prev.onPress === next.onPress &&
  prev.labels === next.labels,
)

export const cardStyles = StyleSheet.create({
  card: { marginBottom: 16, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  dateText: { fontSize: 12 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: '500' },
  body: { padding: 16 },
  moreText: { marginTop: 8, textAlign: 'center', fontSize: 12 },
  summarySection: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  summaryLabelMuted: { fontSize: 12, fontStyle: 'italic' },
  summaryValueMuted: { fontSize: 12, fontWeight: '500', fontStyle: 'italic' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '700' },
})

export default OrderCard
