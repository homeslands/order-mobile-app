/**
 * Nút trên header các màn: kính thật trên iOS 26+, nền đặc ở mọi nơi khác.
 *
 * Tách ra từ CircleButton trong floating-header.tsx. Trước đó mỗi màn có
 * header tự vẽ lại đúng cái nút này bằng nền đặc cứng, nên khi Liquid Glass
 * vào app thì chỉ FloatingHeader đổi, còn Tài khoản, Lịch sử đơn, Thẻ quà...
 * vẫn đặc — nhìn lệch hẳn nhau. Gom một chỗ để không lệch nữa.
 *
 * Nhận `size` vì các màn đang dùng ba cỡ khác nhau (36, 38, 42) và đây không
 * phải lúc đi thống nhất cỡ: đổi cỡ là đổi bố cục từng header, việc khác.
 */
import { memo, type ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { GlassSurface } from '@/components/ui/glass-surface'
import { colors } from '@/constants'
import { useGlassEnabled } from '@/hooks/use-glass'

interface GlassHeaderButtonProps {
  isDark: boolean
  onPress?: () => void
  children: ReactNode
  /** Chiều cao, cũng là bề rộng khi là nút tròn. Mặc định 38. */
  size?: number
  /** Bỏ trống = nút tròn. Có giá trị = viên thuốc, bề rộng theo nội dung. */
  paddingHorizontal?: number
  /** Đè màu nền đặc — dùng cho trạng thái đang bật (vd. nút lọc có lọc). */
  solidColor?: string
  /** Bỏ shadow ở nhánh nền đặc — dùng khi nút đang có nền nhấn riêng. */
  withoutShadow?: boolean
  hitSlop?: number
  style?: StyleProp<ViewStyle>
}

export const GlassHeaderButton = memo(function GlassHeaderButton({
  isDark,
  onPress,
  children,
  size = 38,
  paddingHorizontal,
  solidColor,
  withoutShadow = false,
  hitSlop = 8,
  style,
}: GlassHeaderButtonProps) {
  const glass = useGlassEnabled()
  const solidBg = solidColor ?? (isDark ? colors.card.dark : colors.white.light)
  const radius = size / 2
  const isPill = paddingHorizontal !== undefined

  // Kích thước và lề trong nằm ở lớp kính bên trong; Pressable chỉ ôm lấy nó.
  // Đặt cả hai lớp cùng `paddingHorizontal` sẽ cộng đôi lề (16 thành 32) và
  // viên thuốc phình ra không khớp nút tròn đối diện.
  const inner = {
    height: size,
    borderRadius: radius,
    ...(isPill ? { paddingHorizontal } : { width: size }),
  }
  const outer = { height: size, borderRadius: radius }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      style={[
        outer,
        // Nền đặc + bo tròn ngay trên view mang shadow — nếu không, shadow đổ
        // từ một layer vuông trong suốt, ra bóng vuông (iOS) hoặc mất bóng
        // (Android elevation cần outline khớp hình dạng nội dung).
        !glass && { backgroundColor: solidBg },
        !glass && !withoutShadow && s.shadow,
        style,
      ]}
    >
      <GlassSurface
        color={solidBg}
        radius={radius}
        interactive
        style={[inner, s.center]}
      >
        {children}
      </GlassSurface>
    </Pressable>
  )
})

const s = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 2,
  },
})
