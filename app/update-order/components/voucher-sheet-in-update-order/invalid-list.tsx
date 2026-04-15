import { VoucherCard } from '@/components/cart/voucher-card'
import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { StyleSheet, Text, View } from 'react-native'

type InvalidListProps = {
  vouchers: ProcessedVoucher[]
  onSelect: (slug: string) => void
  onViewCondition: (v: IVoucher) => void
  isDark: boolean
  primaryColor: string
}

export function InvalidList({
  vouchers,
  onSelect,
  onViewCondition,
  isDark,
  primaryColor,
}: InvalidListProps) {
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
          Không khả dụng
        </Text>
      </View>
      {vouchers.slice(0, 5).map((p) => (
        <View key={p.voucher.slug} style={{ opacity: 0.5 }} pointerEvents="none">
          <VoucherCard
            voucher={p.voucher}
            isSelected={false}
            primaryColor={primaryColor}
            isDark={isDark}
            onSelect={onSelect}
            onViewCondition={onViewCondition}
            errorMessage={p.errorMessage}
            discountLabel={p.discountLabel}
            expiryText={p.expiryText}
            minOrderText={p.minOrderText}
            usagePercent={p.usagePercent}
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
