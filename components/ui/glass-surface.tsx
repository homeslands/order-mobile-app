/**
 * Nền Liquid Glass dùng chung cho mọi bề mặt nổi.
 *
 * Gói đúng một luật: có kính thì vẽ kính (pha thêm màu nền theo mức người
 * dùng chọn), không thì vẽ nền đặc y như giao diện cũ. Bên gọi chỉ cần đưa
 * vào màu nền đặc của chính nó.
 *
 * `GlassView` rơi về View trơn và **mất luôn nền** trên máy không hỗ trợ,
 * nên nhánh nền đặc ở đây là bắt buộc, không phải phòng xa.
 */
import { GlassView } from 'expo-glass-effect'
import { memo, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { useGlassLevel } from '@/hooks/use-glass-level'
import { glassTint } from '@/utils/glass-surface'

type GlassSurfaceProps = {
  /** Màu nền đặc của bề mặt — cũng là màu pha, và là đường lui khi không kính. */
  color: string
  radius?: number
  /** Màu pha riêng, cho bề mặt cần giữ màu thương hiệu (nút giỏ hàng). */
  tint?: string
  /** Biến dạng khi chạm — chỉ dùng cho nút bấm. */
  interactive?: boolean
  style?: StyleProp<ViewStyle>
  children?: ReactNode
  testID?: string
}

export const GlassSurface = memo(function GlassSurface({
  color,
  radius,
  tint,
  interactive,
  style,
  children,
  testID,
}: GlassSurfaceProps) {
  const level = useGlassLevel()

  if (level <= 0) {
    return (
      <View
        testID={testID}
        style={[
          style,
          { backgroundColor: color, borderRadius: radius, overflow: 'hidden' },
        ]}
      >
        {children}
      </View>
    )
  }

  return (
    <View
      testID={testID}
      style={[style, { borderRadius: radius, overflow: 'hidden' }]}
    >
      <GlassView
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        glassEffectStyle="regular"
        tintColor={glassTint(color, level, tint)}
        isInteractive={interactive}
        // Nút bấm (interactive) cần tự nhận chạm để morph kính chạy — pointerEvents
        // "none" sẽ loại view này khỏi hit-testing và chặn luôn hiệu ứng đó.
        // Không interactive thì giữ "none" để chạm xuyên xuống Pressable cha.
        pointerEvents={interactive ? undefined : 'none'}
      />
      {children}
    </View>
  )
})
