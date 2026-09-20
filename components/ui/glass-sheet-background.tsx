/**
 * Nền kính cho bottom sheet của gorhom.
 *
 * Gắn qua prop `backgroundComponent`; gorhom sẽ không tự vẽ nền nữa, nên
 * `backgroundStyle` của sheet phải bỏ đi (nếu giữ, nó vẽ đè lên kính).
 */
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet'
import { memo } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'

import { GlassSurface } from '@/components/ui/glass-surface'
import { colors } from '@/constants'

/** Bo góc trên của sheet — khớp giá trị mặc định của gorhom. */
const SHEET_RADIUS = 24

export const GlassSheetBackground = memo(function GlassSheetBackground({
  style,
}: BottomSheetBackgroundProps) {
  const isDark = useColorScheme() === 'dark'
  const color = isDark ? colors.card.dark : colors.white.light

  return (
    <GlassSurface
      color={color}
      radius={SHEET_RADIUS}
      style={[style, StyleSheet.absoluteFill]}
    />
  )
})
