/**
 * Nền kính cho bottom sheet của gorhom.
 *
 * Gắn qua prop `backgroundComponent`; gorhom sẽ không tự vẽ nền nữa, nên
 * `backgroundStyle` của sheet phải bỏ đi (nếu giữ, nó vẽ đè lên kính).
 */
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet'
import { memo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'

import { GlassSurface } from '@/components/ui/glass-surface'
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
    // GlassSurface không nhận prop accessibility/pointerEvents, nên bọc
    // ngoài bằng View thường để giữ đúng hành vi nền mặc định của gorhom
    // (`BottomSheetBackground`): accessible, accessibilityRole, label, và
    // pointerEvents gorhom truyền xuống ("none" — chạm xuyên qua nền).
    <View
      pointerEvents={pointerEvents}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Bottom Sheet"
      style={[style, StyleSheet.absoluteFill]}
    >
      <GlassSurface
        color={color}
        radius={SHEET_RADIUS}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
})
