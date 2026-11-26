import { VoucherCard } from '@/components/cart/voucher-card'
import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'

/** Mã không dùng được không chọn được — chạm vào thân thẻ không làm gì. */
const noop = () => {}

/** Số mã hiện sẵn; phần còn lại mở bằng nút "Xem thêm (N)". */
const INITIAL_COUNT = 5

/**
 * Lý do mã không dùng được, in ngay dưới thẻ và KHÔNG làm mờ — khách cần đọc
 * được nó mà không phải mở sheet Điều kiện. Lý do rỗng thì không in gì.
 */
export function VoucherUnavailableReason({
  message,
  isDark,
}: {
  message: string
  isDark: boolean
}) {
  if (!message) return null
  return (
    <Text
      testID="voucher-unavailable-reason"
      style={[
        styles.reason,
        { color: isDark ? colors.destructive.dark : colors.destructive.light },
      ]}
    >
      {message}
    </Text>
  )
}

type InvalidListProps = {
  vouchers: ProcessedVoucher[]
  onViewCondition: (v: IVoucher) => void
  isDark: boolean
  primaryColor: string
}

export function InvalidList({
  vouchers,
  onViewCondition,
  isDark,
  primaryColor,
}: InvalidListProps) {
  const { t } = useTranslation('voucher')
  const [expanded, setExpanded] = useState(false)
  const handleShowMore = useCallback(() => setExpanded(true), [])
  if (vouchers.length === 0) return null

  const shown = expanded ? vouchers : vouchers.slice(0, INITIAL_COUNT)
  const hiddenCount = vouchers.length - shown.length

  return (
    <>
      <View style={styles.listHeader}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? colors.gray[400] : colors.gray[500],
          }}
        >
          {t('unavailable')}
        </Text>
      </View>
      {shown.map((p) => (
        // Chỉ thân thẻ mờ (`dimmed`); link "Điều kiện" và dòng lý do giữ rõ
        // để khách biết ngay vì sao mã không dùng được.
        <View key={p.voucher.slug}>
          <VoucherCard
            voucher={p.voucher}
            isSelected={false}
            primaryColor={primaryColor}
            isDark={isDark}
            onSelect={noop}
            onViewCondition={onViewCondition}
            expiryText={p.expiryText}
            discountLabel={p.discountLabel}
            dimmed
          />
          <VoucherUnavailableReason message={p.errorMessage} isDark={isDark} />
        </View>
      ))}
      {hiddenCount > 0 && (
        <Pressable onPress={handleShowMore} style={styles.showMoreBtn}>
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: primaryColor }}
          >
            {t('showMoreUnavailable', { count: hiddenCount })}
          </Text>
        </Pressable>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  reason: {
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
})
