import React, { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Skeleton } from '@/components/ui'

/**
 * Khung thẻ đơn khi chưa có dữ liệu — chỉ vùng danh sách (dùng làm
 * ListEmptyComponent), header + chip lọc của màn là thật nên lúc dữ liệu về
 * không nhảy bố cục. Cùng khung với OrderHistoryCard.
 */
function OrderHistorySkeletonListComponent({ cardBg }: { cardBg: string }) {
  return (
    <View testID="order-history-skeleton" style={styles.list}>
      {SKELETON_KEYS.map((key) => (
        <View key={key} style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.row}>
            <Skeleton style={{ width: 120, height: 13, borderRadius: 6 }} />
            <Skeleton style={{ width: 96, height: 22, borderRadius: 11 }} />
          </View>
          <View style={styles.thumbs}>
            {THUMB_KEYS.map((k) => (
              <Skeleton key={k} style={styles.thumb} />
            ))}
          </View>
          <Skeleton style={{ width: '70%', height: 14, borderRadius: 6 }} />
          <View style={styles.row}>
            <Skeleton style={{ width: 56, height: 13, borderRadius: 6 }} />
            <Skeleton style={{ width: 110, height: 16, borderRadius: 6 }} />
          </View>
        </View>
      ))}
    </View>
  )
}

const SKELETON_KEYS = [1, 2, 3, 4]
const THUMB_KEYS = [1, 2, 3]

const styles = StyleSheet.create({
  list: { paddingTop: 52, gap: 10 },
  card: { marginHorizontal: 16, borderRadius: 12, padding: 12, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
})

export const OrderHistorySkeletonList = memo(OrderHistorySkeletonListComponent)
