import { VoucherCard } from '@/components/cart/voucher-card'
import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { StyleSheet, Text, View } from 'react-native'

type SearchResultProps = {
  isFetching: boolean
  searchCode: string
  fetchedVoucher: IVoucher | null
  processedFetched: ProcessedVoucher | null
  selectedVoucher: IVoucher | null
  onSelect: (slug: string) => void
  onViewCondition: (v: IVoucher) => void
  isDark: boolean
  primaryColor: string
}

export function SearchResult({
  isFetching,
  searchCode,
  fetchedVoucher,
  processedFetched,
  selectedVoucher,
  onSelect,
  onViewCondition,
  isDark,
  primaryColor,
}: SearchResultProps) {
  if (searchCode.length === 0) return null

  if (isFetching) {
    return (
      <View style={styles.resultRow}>
        <Text
          style={{ color: isDark ? colors.gray[400] : colors.gray[500], fontSize: 13 }}
        >
          Đang tìm...
        </Text>
      </View>
    )
  }

  if (!fetchedVoucher) {
    return (
      <View style={styles.resultRow}>
        <Text style={{ color: colors.destructive.light, fontSize: 13 }}>
          Không tìm thấy mã &quot;{searchCode}&quot;
        </Text>
      </View>
    )
  }

  if (!processedFetched) return null

  return (
    <VoucherCard
      voucher={fetchedVoucher}
      isSelected={selectedVoucher?.slug === fetchedVoucher.slug}
      primaryColor={primaryColor}
      isDark={isDark}
      onSelect={onSelect}
      onViewCondition={onViewCondition}
      discountLabel={processedFetched.discountLabel}
      expiryText={processedFetched.expiryText}
      minOrderText={processedFetched.minOrderText}
      usagePercent={processedFetched.usagePercent}
    />
  )
}

const styles = StyleSheet.create({
  resultRow: { marginTop: 14 },
})
