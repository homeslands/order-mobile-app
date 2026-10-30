import { VoucherCard } from '@/components/cart/voucher-card'
import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'

/** Mã không dùng được không chọn được — chạm vào thân thẻ không làm gì. */
const noop = () => {}

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
  if (vouchers.length === 0) return null

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
      {vouchers.slice(0, 5).map((p) => (
        // Không chặn chạm cả khối: link "Điều kiện" là đường duy nhất để khách
        // biết vì sao mã không dùng được (thẻ không còn dòng lý do).
        <View key={p.voucher.slug} style={{ opacity: 0.5 }}>
          <VoucherCard
            voucher={p.voucher}
            isSelected={false}
            primaryColor={primaryColor}
            isDark={isDark}
            onSelect={noop}
            onViewCondition={onViewCondition}
            expiryText={p.expiryText}
            discountLabel={p.discountLabel}
          />
        </View>
      ))}
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
})
