/**
 * Nền cho bottom sheet của gorhom.
 *
 * Nền sheet **không dùng Liquid Glass**: trên iOS 26 Apple để kính cho lớp
 * điều khiển nổi trên nội dung (thanh tab, thanh công cụ, nút), còn nền của
 * sheet vẫn là nền đặc. Kính ở đây chỉ làm chữ khó đọc và bị lớp mờ phía sau
 * của sheet nhuộm thành đục sữa. Vì vậy nền này đặc ở mọi mức độ trong người
 * dùng chọn.
 *
 * Gắn qua prop `backgroundComponent`; gorhom sẽ không tự vẽ nền nữa, nên
 * `backgroundStyle` của sheet phải bỏ đi (nếu giữ, nó vẽ đè lên nền này).
 */
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet'
import { memo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'

import { colors } from '@/constants'

/**
 * Bo góc trên của sheet — theo quy ước drawer/sheet đáy hiện có của app
 * (`components/ui/drawer.tsx` dùng `rounded-t-3xl`, tức 24). Đây KHÔNG phải
 * giá trị mặc định của gorhom (gorhom mặc định bo 15 ở
 * `BottomSheetBackground`), và giá trị đó cũng không còn ý nghĩa gì một khi
 * đã gắn `backgroundComponent` — component mặc định của gorhom bị bỏ qua
 * hoàn toàn.
 */
const SHEET_RADIUS = 24

export const GlassSheetBackground = memo(function GlassSheetBackground({
  style,
  pointerEvents,
}: BottomSheetBackgroundProps) {
  const isDark = useColorScheme() === 'dark'
  const color = isDark ? colors.card.dark : colors.white.light

  return (
    // Giữ đúng hành vi nền mặc định của gorhom (`BottomSheetBackground`):
    // accessible, accessibilityRole, label, và pointerEvents gorhom truyền
    // xuống ("none" — chạm xuyên qua nền).
    <View
      pointerEvents={pointerEvents}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Bottom Sheet"
      style={[
        style,
        StyleSheet.absoluteFill,
        {
          backgroundColor: color,
          borderRadius: SHEET_RADIUS,
          overflow: 'hidden',
        },
      ]}
    />
  )
})
