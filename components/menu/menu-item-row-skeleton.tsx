/**
 * Skeleton dòng món của tab Menu — cùng khung với MenuItemRow
 * (app/(tabs)/menu/menu-item-row.tsx): ảnh 128×128 padding 8, nội dung padding
 * 12, cách nhau 12. Khung khớp để lúc dữ liệu về không nhảy bố cục.
 */
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Skeleton } from '@/components/ui'
import { colors } from '@/constants'

const ROWS = [0, 1, 2, 3, 4, 5]

export const MenuItemRowSkeleton = memo(function MenuItemRowSkeleton({
  isDark,
}: {
  isDark: boolean
}) {
  const cardBg = isDark ? colors.card.dark : colors.card.light
  return (
    <View testID="menu-row-skeleton">
      {ROWS.map((i) => (
        <View key={i} style={styles.wrapper}>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.imageWrap}>
              <Skeleton style={styles.image} />
            </View>
            <View style={styles.content}>
              <View>
                <Skeleton style={styles.name} />
                <Skeleton style={styles.price} />
              </View>
              <Skeleton style={styles.addButton} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12, paddingHorizontal: 16 },
  card: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden' },
  imageWrap: { width: 128, height: 128, padding: 8 },
  image: { flex: 1, borderRadius: 12 },
  content: { flex: 1, padding: 12, justifyContent: 'space-between' },
  name: { height: 16, width: '70%' },
  price: { height: 14, width: '35%', marginTop: 8 },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignSelf: 'flex-end',
  },
})
