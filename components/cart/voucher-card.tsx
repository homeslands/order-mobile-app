/**
 * Thẻ voucher dạng vé — dùng trong các sheet chọn mã (giỏ hàng, sửa đơn).
 *
 *   phần trên   tên, mức giảm, mô tả, hạn dùng (+ "Sắp hết lượt" khi còn < 20%)
 *   phần dưới   điều kiện, ngăn bằng đường đứt và hai vết khuyết hai bên
 *
 * Chọn mã bằng cách chạm vào CẢ THẺ; thẻ đang chọn viền primary. Không có nút
 * hay chữ riêng cho việc chọn.
 *
 * Viền LUÔN tồn tại, chỉ đổi màu — lúc không chọn thì màu primary alpha 0.
 * Nếu bật/tắt `borderWidth` thì mỗi lần chọn nội dung bị đẩy vào 1.5px, thấy
 * rõ thành cú giật. Màu viền và màu nền chuyển bằng Reanimated trên UI
 * thread, không qua JS.
 *
 * Vết khuyết làm bằng hai hình tròn tô MÀU NỀN CỦA SHEET, không phải cắt
 * thật. Cách này chỉ đúng khi nền phía sau là màu đặc — và đúng là vậy:
 * cả hai sheet dùng thẻ này đều gắn GlassSheetBackground, vốn luôn đặc
 * (xem chú thích trong components/ui/glass-sheet-background.tsx). Nếu sau này
 * đặt thẻ lên nền ảnh hay gradient thì phải chuyển sang vẽ khung bằng SVG,
 * vì hai hình tròn sẽ lộ ra thành hai chấm.
 */
import { colors, TIMING_CONFIGS } from '@/constants'
import { hexToRgba } from '@/lib/utils'
import type { IVoucher } from '@/types'
import { Info } from 'lucide-react-native'
import { memo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Line } from 'react-native-svg'
import { Text } from '@/components/ui/text'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** Đường kính vết khuyết; nửa nằm ngoài mỗi mép thẻ. */
const NOTCH = 18

/**
 * Còn dưới tỉ lệ này thì báo "Sắp hết lượt". Không hiện thanh % cho mọi mã:
 * tỉ lệ tính trên cả chương trình, đa số lúc gần 100% và không giúp khách
 * chọn mã — chỉ báo khan hiếm khi nó có ý nghĩa.
 */
const LOW_STOCK_RATIO = 0.2

export const VoucherCard = memo(function VoucherCard({
  voucher,
  isSelected,
  primaryColor,
  isDark,
  onSelect,
  onViewCondition,
  expiryText,
  discountLabel,
}: {
  voucher: IVoucher
  isSelected: boolean
  primaryColor: string
  isDark: boolean
  onSelect: (slug: string) => void
  onViewCondition?: (voucher: IVoucher) => void
  /** Pre-computed from processVoucherList — 0 compute in card */
  expiryText?: string
  /**
   * Mức giảm ("Giảm 30.000₫"). Tên voucher do admin tự đặt, nhiều khi không
   * nói giảm bao nhiêu — đây là thứ khách cần để chọn mã.
   */
  discountLabel?: string
}) {
  const { t } = useTranslation('voucher')

  const expiry = expiryText ?? ''
  const isLowStock =
    voucher.maxUsage > 0 &&
    voucher.remainingUsage > 0 &&
    voucher.remainingUsage / voucher.maxUsage < LOW_STOCK_RATIO

  const handlePress = useCallback(
    () => onSelect(voucher.slug),
    [onSelect, voucher.slug],
  )

  const handleCondition = useCallback(
    () => onViewCondition?.(voucher),
    [onViewCondition, voucher],
  )

  // Toàn bộ màu từ token của app. Thẻ là khối nhuốm primary nhạt nằm trên
  // sheet màu `card`; vết khuyết tô màu `card` nên lộ ra đúng hình vé. Đang
  // chọn: viền primary và nền nhuốm đậm hơn một bậc.
  const surface = isDark ? colors.card.dark : colors.card.light
  const bgIdle = hexToRgba(primaryColor, isDark ? 0.12 : 0.08)
  const bgOn = hexToRgba(primaryColor, isDark ? 0.22 : 0.16)
  const headlineColor = isDark
    ? colors.foreground.dark
    : colors.foreground.light
  const mutedColor = isDark
    ? colors.mutedForeground.dark
    : colors.mutedForeground.light
  // Đủ đậm để thấy rõ trên nền nhuốm primary.
  const dashColor = hexToRgba(primaryColor, 0.6)
  const lowStockColor = isDark
    ? colors.destructive.dark
    : colors.destructive.light

  const notch = {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: surface,
  }

  // Pha màu từ primary alpha 0 chứ không từ 'transparent': 'transparent' là
  // ĐEN alpha 0, nên nội suy sẽ đi qua vùng xám bẩn trước khi ra màu đúng.
  const borderOff = hexToRgba(primaryColor, 0)
  const progress = useSharedValue(isSelected ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(
      isSelected ? 1 : 0,
      TIMING_CONFIGS.selectionFade,
    )
  }, [isSelected, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [borderOff, primaryColor],
    ),
    backgroundColor: interpolateColor(progress.value, [0, 1], [bgIdle, bgOn]),
  }))

  return (
    <AnimatedPressable onPress={handlePress} style={[s.card, animatedStyle]}>
      <View style={s.head}>
        <Text
          className="font-sans-bold"
          style={[s.title, { color: headlineColor }]}
          numberOfLines={2}
        >
          {voucher.title}
        </Text>

        {discountLabel ? (
          <Text
            className="font-sans-semibold"
            style={[s.discount, { color: primaryColor }]}
            numberOfLines={1}
          >
            {discountLabel}
          </Text>
        ) : null}

        {voucher.description ? (
          <Text
            className="font-sans"
            style={[s.description, { color: mutedColor }]}
          >
            {voucher.description}
          </Text>
        ) : null}

        {expiry || isLowStock ? (
          <View style={s.metaRow}>
            {expiry ? (
              <Text
                className="font-sans"
                style={[s.expiry, s.metaExpiry, { color: mutedColor }]}
                numberOfLines={1}
              >
                {expiry}
              </Text>
            ) : null}
            {isLowStock ? (
              <Text
                className="font-sans-semibold"
                style={[s.lowStock, { color: lowStockColor }]}
              >
                {t('lowStock')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Đường đục lỗ. Vẽ nét đứt bằng SVG chứ không dùng
          `borderStyle: 'dashed'` — trên iOS viền 1px kiểu đó render ra thành
          nét liền. Một node Svg rẻ hơn là xếp vài chục ô vuông nhỏ. */}
      <View style={s.perforation}>
        <View style={[notch, s.notchLeft]} />
        <View style={s.dashWrap}>
          <Svg height={1} width="100%">
            <Line
              x1="0"
              y1="0.5"
              x2="100%"
              y2="0.5"
              stroke={dashColor}
              strokeWidth={1}
              strokeDasharray="6 5"
            />
          </Svg>
        </View>
        <View style={[notch, s.notchRight]} />
      </View>

      <View style={s.foot}>
        <Pressable
          onPress={handleCondition}
          hitSlop={8}
          style={s.conditionBtn}
          disabled={!onViewCondition}
        >
          <Info size={13} color={mutedColor} />
          <Text
            className="font-sans"
            style={[s.conditionText, { color: mutedColor }]}
          >
            {t('condition')}
          </Text>
        </Pressable>
      </View>
    </AnimatedPressable>
  )
})

const s = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 10,
    // Viền luôn chiếm chỗ; chỉ màu đổi. Xem chú thích đầu file.
    borderWidth: 1.5,
  },
  head: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 4,
  },
  title: {
    // Ảnh thiết kế đo ra 32pt, nhưng ở đó tên voucher là chuỗi ngắn kiểu
    // "50% Giảm". Dữ liệu thật dài hơn nên 32 nuốt cả thẻ. Chốt 22 sau khi
    // xem trên máy — vẫn lớn nhất thẻ (mô tả 14, hạn 12) nên giữ được thứ
    // bậc, nhưng không át phần còn lại.
    fontSize: 22,
  },
  discount: {
    fontSize: 14,
  },
  description: {
    fontSize: 14,
  },
  expiry: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaExpiry: {
    flexShrink: 1,
  },
  lowStock: {
    fontSize: 12,
  },
  perforation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  // Nửa vết khuyết thò ra ngoài mép thẻ, nên lề âm bằng nửa đường kính.
  notchLeft: {
    marginLeft: -NOTCH / 2,
  },
  notchRight: {
    marginRight: -NOTCH / 2,
  },
  dashWrap: {
    flex: 1,
    marginHorizontal: 6,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  conditionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conditionText: {
    fontSize: 12,
  },
})
