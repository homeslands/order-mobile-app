/**
 * Tiêu đề nhóm trong danh sách có tiêu đề dính (FlashList
 * `stickyHeaderIndices`) — nhóm danh mục ở Menu, nhóm ngày ở Lịch sử đơn.
 *
 * - Đang lướt (`stuck = false`): chữ trên nền xám, nằm trong danh sách.
 * - Đã dính (`stuck = true`, FlashList vẽ ở lớp tiêu đề dính): thanh tiêu đề
 *   nền trắng tràn ngang, kẻ dưới + bóng nhẹ.
 *
 * Hai trạng thái cùng chiều cao: FlashList đẩy tiêu đề cũ lên theo chiều cao ô
 * trong danh sách, khác chiều cao là lúc chuyển nhóm bị giật.
 */
import { memo } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'

export const STICKY_SECTION_HEADER_HEIGHT = 48

export const StickySectionHeader = memo(function StickySectionHeader({
  title,
  subtitle,
  stuck,
  isDark,
}: {
  title: string
  subtitle: string
  stuck: boolean
  isDark: boolean
}) {
  return (
    <View
      testID="sticky-section-header"
      style={[
        styles.base,
        stuck
          ? [
              styles.stuck,
              {
                backgroundColor: isDark ? colors.card.dark : colors.card.light,
                borderBottomColor: isDark
                  ? colors.border.dark
                  : colors.border.light,
              },
            ]
          : {
              backgroundColor: isDark
                ? colors.background.dark
                : colors.background.light,
            },
      ]}
    >
      <Text
        style={[
          styles.name,
          { color: isDark ? colors.gray[50] : colors.gray[900] },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.count,
          { color: isDark ? colors.gray[400] : colors.gray[500] },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  base: {
    height: STICKY_SECTION_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
  },
  stuck: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
  },
  count: {
    fontSize: 13,
  },
})
