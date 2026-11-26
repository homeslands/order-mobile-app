/**
 * Thẻ đơn gọn ở màn Lịch sử đơn: loại đơn + giờ (ngày ở tiêu đề nhóm), nhãn trạng thái, dải ảnh
 * món (tối đa 4, "+N"), tên món gộp một dòng, số món + tổng tiền.
 *
 * Bảng tính tiền chi tiết (tạm tính, khuyến mãi, voucher, điểm, phí giao)
 * nằm ở màn chi tiết đơn — thẻ chỉ cần đủ để khách nhận ra đơn.
 */
import { ShoppingBag, Truck, Utensils } from 'lucide-react-native'
import { memo, useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { MenuItemImage } from '@/components/menu/menu-item-image'
import { OrderStatusBadge } from '@/components/order-history/order-status-badge'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import {
  getOrderHistoryStatus,
  type OrderHistoryStatus,
} from '@/lib/order-history-status'
import type { IOrder } from '@/types'
import { getProductImageUrl, IMAGE_PRESET } from '@/utils/product-image-url'

const MAX_THUMBS = 4
const THUMB = 44

export type OrderHistoryCardLabels = {
  type: Record<string, string>
  status: Record<OrderHistoryStatus, string>
  itemCount: (n: number) => string
  total: string
  formatPrice: (n: number) => string
}

const pad = (n: number) => String(n).padStart(2, '0')
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function TypeIcon({ type, color }: { type: string; color: string }) {
  if (type === 'delivery') return <Truck size={14} color={color} />
  if (type === 'at-table') return <Utensils size={14} color={color} />
  return <ShoppingBag size={14} color={color} />
}

export const OrderHistoryCard = memo(function OrderHistoryCard({
  order,
  primaryColor,
  isDark,
  labels,
  onPress,
}: {
  order: IOrder
  primaryColor: string
  isDark: boolean
  labels: OrderHistoryCardLabels
  onPress: (slug: string) => void
}) {
  const handlePress = useCallback(
    () => onPress(order.slug),
    [onPress, order.slug],
  )

  const view = useMemo(() => {
    const items = order.orderItems ?? []
    let qty = 0
    for (const it of items) qty += it.quantity ?? 0
    const names = items
      .map((it) => {
        const name = capFirst(it.variant?.product?.name ?? '')
        return it.quantity > 1 ? `${name} ×${it.quantity}` : name
      })
      .filter(Boolean)
      .join(', ')
    const thumbs = items.slice(0, MAX_THUMBS).map((it, i) => ({
      key: `${it.slug ?? ''}-${i}`,
      url: getProductImageUrl(it.variant?.product?.image, {
        maxWidth: IMAGE_PRESET.THUMB,
      }),
    }))
    const d = new Date(order.createdAt)
    const time = Number.isNaN(d.getTime())
      ? ''
      : `${pad(d.getHours())}:${pad(d.getMinutes())}`
    return {
      qty,
      names,
      thumbs,
      more: Math.max(0, items.length - MAX_THUMBS),
      time,
    }
  }, [order.orderItems, order.createdAt])

  const status = getOrderHistoryStatus(order)
  const muted = isDark ? colors.gray[400] : colors.gray[500]
  const strong = isDark ? colors.gray[50] : colors.gray[900]
  const typeLabel = labels.type[order.type] ?? ''

  return (
    <Pressable
      onPress={handlePress}
      style={[
        s.card,
        { backgroundColor: isDark ? colors.card.dark : colors.card.light },
      ]}
    >
      <View style={s.topRow}>
        <View style={s.typeRow}>
          <TypeIcon type={order.type} color={muted} />
          <Text style={[s.typeText, { color: muted }]}>
            {[typeLabel, view.time].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <OrderStatusBadge status={status} label={labels.status[status]} />
      </View>

      <View style={s.thumbRow}>
        {view.thumbs.map((th) => (
          <View
            key={th.key}
            style={[
              s.thumb,
              {
                backgroundColor: isDark ? colors.border.dark : colors.gray[100],
              },
            ]}
          >
            <MenuItemImage
              id={th.key}
              imageUrl={th.url}
              priority="normal"
              borderRadius={8}
            />
          </View>
        ))}
        {view.more > 0 && (
          <View
            style={[
              s.thumb,
              s.more,
              {
                backgroundColor: isDark ? colors.border.dark : colors.gray[100],
              },
            ]}
          >
            <Text style={[s.moreText, { color: muted }]}>+{view.more}</Text>
          </View>
        )}
      </View>

      <Text style={[s.names, { color: strong }]} numberOfLines={1}>
        {view.names}
      </Text>

      <View style={s.bottomRow}>
        <Text style={[s.count, { color: muted }]}>
          {labels.itemCount(view.qty)}
        </Text>
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: muted }]}>{labels.total}</Text>
          <Text style={[s.totalValue, { color: primaryColor }]}>
            {labels.formatPrice(order.subtotal ?? 0)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
})

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  typeText: { fontSize: 13 },
  thumbRow: { flexDirection: 'row', gap: 6 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    overflow: 'hidden',
  },
  more: { alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 13, fontWeight: '600' },
  names: { fontSize: 14, fontWeight: '500' },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  count: { fontSize: 13 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 16, fontWeight: '700' },
})
