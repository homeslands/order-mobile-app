import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { Ticket } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

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
  const discount = discountLabel ?? ''
  const expiry = expiryText ?? ''
  const minOrder = minOrderText ?? ''
  const usage = usagePercent ?? 0

  const handlePress = useCallback(() => onSelect(voucher.slug), [onSelect, voucher.slug])

  return (
    <Pressable onPress={handlePress} style={[
      vcStyles.card,
      { borderColor: isSelected ? primaryColor : isDark ? colors.gray[700] : colors.gray[200] },
      isSelected && { backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10` },
    ]}>
      <View style={vcStyles.row}>
        {/* Left strip */}
        <View style={[vcStyles.strip, { backgroundColor: primaryColor }]}>
          <Ticket size={28} color={colors.white.light} />
        </View>

        {/* Dashed separator */}
        <View style={[vcStyles.dashed, { borderColor: isDark ? colors.gray[700] : colors.gray[200] }]} />

        {/* Content */}
        <View style={vcStyles.content}>
          <Text style={[vcStyles.cardTitle, { color: isDark ? colors.gray[50] : colors.gray[900] }]} numberOfLines={2}>
            {voucher.title}
          </Text>
          <Text style={[vcStyles.discountLabel, { color: primaryColor }]}>
            {discount}
          </Text>
          <Text style={[vcStyles.minOrder, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
            Giá trị đơn hàng tối thiểu: {minOrder}
          </Text>
          {errorMessage ? (
            <Text style={vcStyles.errorText}>{errorMessage}</Text>
          ) : null}

          {/* Payment method tags */}
          {voucher.voucherPaymentMethods?.length > 0 && (
            <View style={vcStyles.pmRow}>
              {voucher.voucherPaymentMethods.map((pm) => (
                <View key={pm.slug} style={[vcStyles.pmTag, { borderColor: primaryColor, backgroundColor: `${primaryColor}08` }]}>
                  <Text style={[vcStyles.pmTagText, { color: primaryColor }]}>
                    {pm.paymentMethod === 'cash' ? 'Tiền mặt' : pm.paymentMethod === 'bank-transfer' ? 'CK' : pm.paymentMethod === 'point' ? 'Điểm' : 'Thẻ'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Usage progress */}
          {voucher.remainingUsage > 0 && (
            <View style={vcStyles.progressWrap}>
              <Text style={[vcStyles.progressLabel, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
                Số lượng còn lại: {Math.round(usage)}%
              </Text>
              <View style={[vcStyles.progressTrack, { backgroundColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
                <View style={[vcStyles.progressFill, { width: `${usage}%`, backgroundColor: primaryColor }]} />
              </View>
            </View>
          )}

          {/* Expiry + conditions */}
          <View style={vcStyles.bottomRow}>
            <View style={[vcStyles.expiryBadge, { borderColor: primaryColor }]}>
              <Text style={[vcStyles.expiryText, { color: primaryColor }]}>{expiry}</Text>
            </View>
            <Pressable onPress={() => onViewCondition?.(voucher)} hitSlop={8}>
              <Text style={[vcStyles.conditionLink, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
                Điều kiện
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Checkbox circle */}
        <View style={vcStyles.checkWrap}>
          <View style={[
            vcStyles.checkCircle,
            { borderColor: isSelected ? primaryColor : isDark ? colors.gray[600] : colors.gray[300] },
            isSelected && { backgroundColor: primaryColor },
          ]}>
            {isSelected && <View style={vcStyles.checkDot} />}
          </View>
        </View>
      </View>
    </Pressable>
  )
})

const vcStyles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  strip: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: {
    width: 1,
    borderStyle: 'dashed',
    borderLeftWidth: 1.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  discountLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  minOrder: {
    fontSize: 12,
  },
  progressWrap: {
    marginTop: 4,
    gap: 4,
  },
  progressLabel: {
    fontSize: 11,
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
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  expiryBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expiryText: {
    fontSize: 11,
  },
  conditionLink: {
    fontSize: 11,
  },
  errorText: {
    fontSize: 12,
    color: colors.destructive.light,
    fontStyle: 'italic',
    marginTop: 2,
  },
  pmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
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
  checkWrap: {
    justifyContent: 'center',
    paddingRight: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white.light,
  },
})
