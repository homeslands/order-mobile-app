/**
 * Thẻ voucher dạng vé — dùng trong các sheet chọn mã (giỏ hàng, sửa đơn).
 *
 * Bố cục ba vùng, theo thiết kế vé giấy:
 *
 *   phần trên   giá trị giảm (chữ lớn) + tên + hạn dùng
 *   phần giữa   chỉ hiện khi có: đơn tối thiểu, tag phương thức thanh toán,
 *               lượt còn lại, lý do không dùng được
 *   phần dưới   điều kiện + trạng thái chọn, ngăn bằng đường đứt và hai vết
 *               khuyết hai bên
 *
 * Vùng giữa co lại khi voucher đơn giản, nên thẻ trông gần đúng mẫu thiết kế;
 * voucher nhiều điều kiện thì cao hơn. Không bỏ được: bộ chọn bắt buộc phải
 * nói vì sao một mã không dùng được, nếu không người dùng bấm mà không hiểu
 * sao không ăn.
 *
 * Vết khuyết làm bằng hai hình tròn tô MÀU NỀN CỦA SHEET, không phải cắt
 * thật. Cách này chỉ đúng khi nền phía sau là màu đặc — và đúng là vậy:
 * cả hai sheet dùng thẻ này đều gắn GlassSheetBackground, vốn luôn đặc
 * (xem chú thích trong components/ui/glass-sheet-background.tsx). Nếu sau này
 * đặt thẻ lên nền ảnh hay gradient thì phải chuyển sang vẽ khung bằng SVG,
 * vì hai hình tròn sẽ lộ ra thành hai chấm.
 */
import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { Check, Info } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'

/** Đường kính vết khuyết; nửa nằm ngoài mỗi mép thẻ. */
const NOTCH = 18

export const VoucherCard = memo(function VoucherCard({
  voucher,
  isSelected,
  primaryColor,
  isDark,
  onSelect,
  onViewCondition,
  errorMessage,
  discountLabel,
  expiryText,
  minOrderText,
  usagePercent,
}: {
  voucher: IVoucher
  isSelected: boolean
  primaryColor: string
  isDark: boolean
  onSelect: (slug: string) => void
  onViewCondition?: (voucher: IVoucher) => void
  errorMessage?: string
  /** Pre-computed from processVoucherList — 0 compute in card */
  discountLabel?: string
  expiryText?: string
  minOrderText?: string
  usagePercent?: number
}) {
  const { t } = useTranslation('voucher')

  const discount = discountLabel ?? ''
  const expiry = expiryText ?? ''
  const minOrder = minOrderText ?? ''
  const usage = usagePercent ?? 0

  const handlePress = useCallback(
    () => onSelect(voucher.slug),
    [onSelect, voucher.slug],
  )

  const handleCondition = useCallback(
    () => onViewCondition?.(voucher),
    [onViewCondition, voucher],
  )

  // Nền thẻ: tông kem ấm, lấy từ cặp token warning đã có sẵn trong palette
  // thay vì thêm token mới chỉ dùng một chỗ.
  const surface = isDark ? colors.card.dark : colors.white.light
  const ticketBg = isSelected
    ? isDark
      ? colors.warning.iconBgDark
      : colors.warning.iconBgLight
    : isDark
      ? colors.warning.bgDark
      : colors.warning.bgLight
  const borderColor = isSelected
    ? primaryColor
    : isDark
      ? colors.warning.borderDark
      : colors.warning.borderLight
  const titleColor = isDark ? colors.gray[50] : colors.gray[900]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[600]
  const dashColor = isDark ? colors.gray[700] : colors.warning.borderLight

  const hasDetails =
    !!minOrder ||
    !!errorMessage ||
    voucher.voucherPaymentMethods?.length > 0 ||
    voucher.remainingUsage > 0

  const notch = {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: surface,
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[
        s.card,
        { backgroundColor: ticketBg, borderColor },
        isSelected && s.cardSelected,
      ]}
    >
      {/* ── Phần trên ─────────────────────────────────────────────── */}
      <View style={s.head}>
        <Text style={[s.discount, { color: primaryColor }]} numberOfLines={1}>
          {discount}
        </Text>
        <Text style={[s.title, { color: titleColor }]} numberOfLines={2}>
          {voucher.title}
        </Text>
        {expiry ? (
          <Text style={[s.expiry, { color: mutedColor }]} numberOfLines={1}>
            {expiry}
          </Text>
        ) : null}
      </View>

      {/* ── Phần giữa: chỉ hiện khi voucher có điều kiện kèm theo ──── */}
      {hasDetails ? (
        <View style={s.details}>
          {minOrder ? (
            <Text style={[s.detailText, { color: mutedColor }]}>
              {t('minOrderLabel', { value: minOrder })}
            </Text>
          ) : null}

          {voucher.voucherPaymentMethods?.length > 0 ? (
            <View style={s.pmRow}>
              {voucher.voucherPaymentMethods.map((pm) => (
                <View
                  key={pm.slug}
                  style={[s.pmTag, { borderColor: primaryColor }]}
                >
                  <Text style={[s.pmTagText, { color: primaryColor }]}>
                    {pm.paymentMethod === 'cash'
                      ? t('paymentMethodShort.cash')
                      : pm.paymentMethod === 'bank-transfer'
                        ? t('paymentMethodShort.bankTransfer')
                        : pm.paymentMethod === 'point'
                          ? t('paymentMethodShort.point')
                          : t('paymentMethodShort.creditCard')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {voucher.remainingUsage > 0 ? (
            <View style={s.progressWrap}>
              <Text style={[s.detailText, { color: mutedColor }]}>
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

          {errorMessage ? (
            <Text style={s.errorText}>{errorMessage}</Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Đường đục lỗ ──────────────────────────────────────────── */}
      <View style={s.perforation}>
        <View style={[notch, s.notchLeft]} />
        <View style={[s.dash, { borderColor: dashColor }]} />
        <View style={[notch, s.notchRight]} />
      </View>

      {/* ── Phần dưới ─────────────────────────────────────────────── */}
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

        <View style={s.selectWrap}>
          {isSelected ? <Check size={15} color={primaryColor} /> : null}
          <Text
            style={[
              s.selectText,
              { color: isSelected ? primaryColor : mutedColor },
              isSelected && s.selectTextOn,
            ]}
          >
            {isSelected ? t('selected') : t('select')}
          </Text>
        </View>
      </View>
    </Pressable>
  )
})

const s = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardSelected: {
    borderWidth: 1.5,
  },
  head: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 2,
  },
  discount: {
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  expiry: {
    fontSize: 12,
  },
  details: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  pmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pmTag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  pmTagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  progressWrap: {
    gap: 4,
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
  errorText: {
    fontSize: 12,
    color: colors.destructive.light,
    fontStyle: 'italic',
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
  dash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 6,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  selectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectText: {
    fontSize: 13,
  },
  selectTextOn: {
    fontWeight: '700',
  },
})
