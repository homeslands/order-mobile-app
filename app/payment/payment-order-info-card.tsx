/**
 * PaymentOrderInfoCard — receipt-style order info section for the payment page.
 * Shows order slug, status badge, created time, customer, order type, delivery
 * address, and order description.
 *
 * Read-only + React.memo'd: parent re-renders (polling, focus effects) do not
 * cascade into this card as long as the order ref is structurally stable
 * (React Query provides structural sharing out of the box).
 */
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants'
import type { useOrderBySlug } from '@/hooks'
import { OrderStatus, OrderTypeEnum } from '@/types'
import { formatDateTime } from '@/utils'

type Order = NonNullable<ReturnType<typeof useOrderBySlug>['data']>['result']

type Props = {
  order: Order
  isDark: boolean
}

export const PaymentOrderInfoCard = memo(function PaymentOrderInfoCard({
  order,
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
      title: { color: isDark ? colors.gray[50] : colors.gray[900] },
      subtle: { color: isDark ? colors.gray[400] : colors.gray[500] },
      value: { color: isDark ? colors.gray[50] : colors.gray[900] },
    }),
    [isDark],
  )

  const statusBadge = useMemo(() => {
    const isPaid =
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.COMPLETED
    const isPending = order.status === OrderStatus.PENDING
    const bg = isPaid
      ? `${colors.success.light}18`
      : isPending
        ? `${colors.warning.light}18`
        : `${colors.gray[500]}18`
    const color = isPaid
      ? colors.success.light
      : isPending
        ? colors.warning.light
        : isDark
          ? colors.gray[400]
          : colors.gray[500]
    const label =
      order.status === OrderStatus.PAID
        ? t('order.paid', 'Đã thanh toán')
        : order.status === OrderStatus.COMPLETED
          ? t('order.completed', 'Hoàn thành')
          : order.status === OrderStatus.PENDING
            ? t('order.pending', 'Chờ thanh toán')
            : order.status
    return { bg, color, label }
  }, [order.status, isDark, t])

  const customerName =
    order.owner?.firstName || order.owner?.lastName
      ? `${order.owner.firstName || ''} ${order.owner.lastName || ''}`.trim()
      : '-'

  const orderTypeLabel =
    order.type === OrderTypeEnum.AT_TABLE
      ? `${t('order.dineIn', 'Tại bàn')} - Bàn số ${order.table?.name || '-'}`
      : order.type === OrderTypeEnum.DELIVERY
        ? t('menu.delivery', 'Giao hàng')
        : t('order.takeAway', 'Mang đi')

  return (
    <View style={[s.card, theme.card]}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={[s.title, theme.title, { flex: 1 }]}>
            {t('order.order', 'Đơn hàng')} #{order.slug}
          </Text>
          <View style={[s.badge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[s.badgeText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
          </View>
        </View>
        <Text style={[s.time, theme.subtle]}>{formatDateTime(order.createdAt)}</Text>
      </View>
      <View style={[s.divider, theme.divider]} />
      <View style={s.body}>
        <View style={s.row}>
          <Text style={[s.label, theme.subtle]}>
            {t('order.customer', 'Khách hàng')}
          </Text>
          <Text style={[s.value, theme.value]}>{customerName}</Text>
        </View>
        {order.owner?.phonenumber && (
          <View style={s.row}>
            <Text style={[s.label, theme.subtle]}>
              {t('order.phone', 'Điện thoại')}
            </Text>
            <Text style={[s.value, theme.value]}>{order.owner.phonenumber}</Text>
          </View>
        )}
        <View style={s.row}>
          <Text style={[s.label, theme.subtle]}>
            {t('order.orderType', 'Loại đơn')}
          </Text>
          <Text style={[s.value, theme.value]}>{orderTypeLabel}</Text>
        </View>
        {order.type === OrderTypeEnum.DELIVERY &&
          order.deliveryTo?.formattedAddress && (
            <View style={s.row}>
              <Text style={[s.label, theme.subtle]}>
                {t('order.deliveryAddress', 'Địa chỉ')}
              </Text>
              <Text
                style={[s.value, theme.value, { flex: 1, textAlign: 'right' }]}
              >
                {order.deliveryTo.formattedAddress}
              </Text>
            </View>
          )}
        {order.description ? (
          <View style={s.row}>
            <Text style={[s.label, theme.subtle]}>
              {t('order.note', 'Ghi chú')}
            </Text>
            <Text
              style={[s.value, theme.value, { flex: 1, textAlign: 'right' }]}
            >
              {order.description}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  card: { marginBottom: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  header: { padding: 16, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  time: { fontSize: 12 },
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
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
})
