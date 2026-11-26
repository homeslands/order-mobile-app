import React, { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Skeleton } from '@/components/ui'

/**
 * Khung thẻ đơn khi chưa có dữ liệu — chỉ vùng danh sách (dùng làm
 * ListEmptyComponent), header nổi + chip lọc của màn là thật nên lúc dữ liệu
 * về không nhảy bố cục.
 */
function OrderHistorySkeletonListComponent({
  cardBg,
  border,
}: {
  cardBg: string
  border: string
}) {
  return (
    <View testID="order-history-skeleton">
      {SKELETON_KEYS.map((key) => (
        <View
          key={key}
          style={[
            styles.skeletonCard,
            { backgroundColor: cardBg, borderColor: border },
          ]}
        >
          <View style={styles.skeletonHeaderRow}>
            <Skeleton style={{ width: 128, height: 12, borderRadius: 6 }} />
            <Skeleton style={{ width: 96, height: 24, borderRadius: 12 }} />
          </View>
          <View style={styles.skeletonItemRow}>
            <Skeleton style={{ width: 64, height: 64, borderRadius: 8 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton style={{ width: 160, height: 16, borderRadius: 6 }} />
              <Skeleton style={{ width: 96, height: 12, borderRadius: 6 }} />
              <Skeleton style={{ width: 112, height: 16, borderRadius: 6 }} />
            </View>
          </View>
          <View style={[styles.skeletonSummary, { borderTopColor: border }]}>
            <View style={styles.skeletonSummaryRow}>
              <Skeleton style={{ width: 96, height: 12, borderRadius: 6 }} />
              <Skeleton style={{ width: 80, height: 12, borderRadius: 6 }} />
            </View>
            <View style={styles.skeletonSummaryRow}>
              <Skeleton style={{ width: 112, height: 16, borderRadius: 6 }} />
              <Skeleton style={{ width: 96, height: 16, borderRadius: 6 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

const SKELETON_KEYS = [1, 2, 3]

const styles = StyleSheet.create({
  skeletonCard: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  skeletonItemRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  skeletonSummary: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  skeletonSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
})

export const OrderHistorySkeletonList = memo(OrderHistorySkeletonListComponent)
