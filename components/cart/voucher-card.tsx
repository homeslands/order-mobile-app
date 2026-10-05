/**
 * Thẻ voucher dạng vé — dùng trong các sheet chọn mã (giỏ hàng, sửa đơn).
 *
 *   phần trên   tên, mô tả, hạn dùng, thanh lượt còn lại
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

export const VoucherCard = memo(function VoucherCard({
  voucher,
  isSelected,
  primaryColor,
  isDark,
  onSelect,
  onViewCondition,
  expiryText,
  usagePercent,
}: {
  voucher: IVoucher
  isSelected: boolean
  primaryColor: string
  isDark: boolean
  onSelect: (slug: string) => void
  onViewCondition?: (voucher: IVoucher) => void
  /** Pre-computed from processVoucherList — 0 compute in card */
  expiryText?: string
  usagePercent?: number
}) {
  const { t } = useTranslation('voucher')

  const expiry = expiryText ?? ''
  const usage = usagePercent ?? 0

  const handlePress = useCallback(
    () => onSelect(voucher.slug),
    [onSelect, voucher.slug],
  )

  const handleCondition = useCallback(
    () => onViewCondition?.(voucher),
    [onViewCondition, voucher],
  )

  const surface = isDark ? colors.card.dark : colors.white.light
  const bgIdle = isDark ? colors.ticket.bgDark : colors.ticket.bgLight
  const bgOn = isDark
    ? colors.ticket.bgSelectedDark
    : colors.ticket.bgSelectedLight
  const headlineColor = isDark
    ? colors.ticket.headlineDark
    : colors.ticket.headlineLight
  const mutedColor = isDark ? colors.gray[400] : colors.gray[600]
  const dashColor = isDark ? colors.ticket.dashDark : colors.ticket.dashLight

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
        <Text style={[s.title, { color: headlineColor }]} numberOfLines={2}>
          {voucher.title}
        </Text>

        {voucher.description ? (
          <Text style={[s.description, { color: mutedColor }]}>
            {voucher.description}
          </Text>
        ) : null}

        {expiry ? (
          <Text style={[s.expiry, { color: mutedColor }]} numberOfLines={1}>
            {expiry}
          </Text>
        ) : null}

        {voucher.remainingUsage > 0 ? (
          <View style={s.progressWrap}>
            <Text style={[s.expiry, { color: mutedColor }]}>
              {t('remainingUsagePercent', { value: Math.round(usage) })}
            </Text>
            <View style={[s.progressTrack, { backgroundColor: dashColor }]}>
              <View
                style={[
                  s.progressFill,
                  { width: `${usage}%`, backgroundColor: primaryColor },
                ]}
              />
            </View>
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
          <Text style={[s.conditionText, { color: mutedColor }]}>
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
    // 32pt — đo từ ảnh thiết kế (89px trên ảnh rộng 1080). Đây là điểm nhìn
    // đầu tiên của thẻ, không phải một nhãn phụ.
    fontSize: 32,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
  },
  expiry: {
    fontSize: 12,
  },
  progressWrap: {
    gap: 4,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
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
