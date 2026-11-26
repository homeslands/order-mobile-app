/**
 * Nhãn trạng thái đơn — dùng chung cho Lịch sử đơn và Chi tiết đơn.
 *
 * Nền đặc tông tươi, chữ trắng đậm; bốn tông khác nhau và không dùng cam
 * thương hiệu (là màu giá tiền). Tông tươi (amber/green-600, red/gray-500)
 * chỉ ~3.2–4.8:1 với chữ trắng nên chữ để đậm 700.
 * Chưa thanh toán: hổ phách. Đã thanh toán: xanh. Hoàn tất: xám. Thất bại: đỏ.
 */
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import type { OrderHistoryStatus } from '@/lib/order-history-status'

export function orderStatusBg(status: OrderHistoryStatus): string {
  switch (status) {
    case 'failed':
      return colors.destructive.light
    case 'paid':
      return colors.success.solid
    case 'completed':
      return colors.gray[500]
    default:
      return colors.warning.solid
  }
}

export const OrderStatusBadge = memo(function OrderStatusBadge({
  status,
  label,
}: {
  status: OrderHistoryStatus
  label: string
}) {
  return (
    <View
      testID="order-status-badge"
      style={[s.badge, { backgroundColor: orderStatusBg(status) }]}
    >
      <Text
        testID="order-status-badge-text"
        style={[s.text, { color: colors.white.light }]}
      >
        {label}
      </Text>
    </View>
  )
})

const s = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '700' },
})
