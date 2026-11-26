/**
 * Skeleton dòng món của tab Menu — cùng khung với MenuItemRow
 * (app/(tabs)/menu/menu-item-row.tsx): thẻ nhóm lề 16 bo 12, ảnh 88×88, chữ bên phải,
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
    <View
      testID="menu-row-skeleton"
      style={[styles.group, { backgroundColor: rowBg }]}
    >
      {ROWS.map((i) => (
        <View key={i} style={styles.row}>
          <Skeleton style={styles.image} />
          <View style={styles.content}>
            <Skeleton style={styles.name} />
            <Skeleton style={styles.desc} />
            <Skeleton style={styles.price} />
          </View>
          <Skeleton style={styles.addButton} />
        </View>
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  group: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  image: { width: 88, height: 88, borderRadius: 12 },
  content: { flex: 1, gap: 6 },
  name: { height: 15, width: '60%' },
  desc: { height: 12, width: '80%' },
  price: { height: 14, width: '30%' },
  addButton: { width: 30, height: 30, borderRadius: 15 },
})
