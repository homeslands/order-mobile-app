/**
 * PaymentOrderInfoCard — receipt-style order info section for the payment page.
 * Shows order code (referenceNumber, tap to copy), shared status badge, created
 * time, order type, delivery recipient / address, and order description.
 *
 * Read-only + React.memo'd: parent re-renders (polling, focus effects) do not
 * cascade into this card as long as the order ref is structurally stable
 * (React Query provides structural sharing out of the box).
 */
import * as Clipboard from 'expo-clipboard'
import { Copy } from 'lucide-react-native'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'

import { OrderStatusBadge } from '@/components/order-history/order-status-badge'
import { colors } from '@/constants'
import type { useOrderBySlug } from '@/hooks'
import { getOrderHistoryStatus } from '@/lib/order-history-status'
import { OrderTypeEnum } from '@/types'
import { formatDateTime, showToast } from '@/utils'
import { Text } from '@/components/ui/text'

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
  const { t: tToast } = useTranslation('toast')

  const theme = useMemo(
    () => ({
      card: {
        backgroundColor: isDark ? colors.card.dark : colors.white.light,
        borderColor: isDark ? colors.border.dark : colors.gray[100],
      },
      divider: {
        backgroundColor: isDark ? colors.border.dark : colors.gray[100],
      },
      title: { color: isDark ? colors.gray[50] : colors.gray[900] },
      subtle: { color: isDark ? colors.gray[400] : colors.gray[500] },
      value: { color: isDark ? colors.gray[50] : colors.gray[900] },
    }),
    [isDark],
  )

  const status = getOrderHistoryStatus(order)
  const statusLabel = t(`order.${status}`)
  const isDelivery = order.type === OrderTypeEnum.DELIVERY

  // Mã đơn dễ đọc (số tham chiếu) — chạm để sao chép, tiện đọc cho quầy.
  // slug là chuỗi ngẫu nhiên, khách không dùng được.
  const orderCode = String(order.referenceNumber ?? order.slug)
  const handleCopyCode = useCallback(() => {
    void Clipboard.setStringAsync(orderCode)
    showToast(tToast('toast.copyCodeSuccess'))
  }, [orderCode, tToast])

  const customerName =
    order.owner?.firstName || order.owner?.lastName
      ? `${order.owner.firstName || ''} ${order.owner.lastName || ''}`.trim()
      : '-'

  const orderTypeLabel =
    order.type === OrderTypeEnum.AT_TABLE
      ? `${t('order.dineIn', 'Tại bàn')} - ${t('order.tableNumber', 'Bàn số')} ${order.table?.name || '-'}`
      : order.type === OrderTypeEnum.DELIVERY
        ? t('menu.delivery', 'Giao hàng')
        : t('order.takeAway', 'Mang đi')

  return (
    <View style={[s.card, theme.card]}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable
            onPress={handleCopyCode}
            hitSlop={6}
            accessibilityRole="button"
            style={s.codeRow}
          >
            <Text style={[s.title, theme.title]}>
              {t('order.order', 'Đơn hàng')} #{orderCode}
            </Text>
            <Copy size={14} color={theme.subtle.color} />
          </Pressable>
          <OrderStatusBadge status={status} label={statusLabel} />
        </View>
        <Text style={[s.time, theme.subtle]}>
          {formatDateTime(order.createdAt)}
        </Text>
      </View>
      <View style={[s.divider, theme.divider]} />
      <View style={s.body}>
        {/* Khách đang trả đơn của chính mình — tên / SĐT chỉ có ích với đơn
            giao hàng (người nhận). */}
        {isDelivery && (
          <>
            <View style={s.row}>
              <Text style={[s.label, theme.subtle]}>
                {t('order.customer', 'Khách hàng')}
              </Text>
              <Text style={[s.value, theme.value]}>{customerName}</Text>
            </View>
            {order.owner?.phonenumber && (
              <View style={s.row}>
                <Text style={[s.label, theme.subtle]}>
                  {t('order.phoneNumber', 'Điện thoại')}
                </Text>
                <Text style={[s.value, theme.value]}>
                  {order.owner.phonenumber}
                </Text>
              </View>
            )}
          </>
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
        {order.type === OrderTypeEnum.DELIVERY && order.deliveryPhone && (
          <View style={s.row}>
            <Text style={[s.label, theme.subtle]}>
              {t('order.deliveryPhone', 'SĐT nhận hàng')}
            </Text>
            <Text style={[s.value, theme.value]}>{order.deliveryPhone}</Text>
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
  card: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
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
  codeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
})
