/**
 * Skeleton dòng món của tab Menu — cùng khung với MenuItemRow
 * (app/(tabs)/menu/menu-item-row.tsx): thẻ riêng lề 16 bo 12, ảnh 88×88, tên trên / giá + nút dưới,
 * nút + 30. Khung khớp để lúc dữ liệu về không nhảy bố cục.
 */
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Skeleton } from '@/components/ui'
import { colors } from '@/constants'

const ROWS = [0, 1, 2, 3, 4, 5, 6]

export const MenuItemRowSkeleton = memo(function MenuItemRowSkeleton({
  isDark,
}: {
  isDark: boolean
}) {
  const rowBg = isDark ? colors.card.dark : colors.card.light
  return (
    <View testID="menu-row-skeleton" style={styles.list}>
      {ROWS.map((i) => (
        <View key={i} style={[styles.row, { backgroundColor: rowBg }]}>
          <Skeleton style={styles.image} />
          <View style={styles.content}>
            <View style={styles.top}>
              <Skeleton style={styles.name} />
              <Skeleton style={styles.desc} />
            </View>
            <View style={styles.bottom}>
              <Skeleton style={styles.price} />
              <Skeleton style={styles.addButton} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  list: { marginTop: 12, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 12,
  },
  image: { width: 88, height: 88, borderRadius: 12 },
  content: { flex: 1, justifyContent: 'space-between' },
  top: { gap: 6 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { height: 15, width: '60%' },
  desc: { height: 12, width: '80%' },
  price: { height: 14, width: '30%' },
  addButton: { width: 30, height: 30, borderRadius: 15 },
})
