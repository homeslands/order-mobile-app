import { VoucherCard } from '@/components/cart/voucher-card'
import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'

/** Mã không dùng được không chọn được — chạm vào thân thẻ không làm gì. */
const noop = () => {}

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
  const { t } = useTranslation('voucher')
  if (searchCode.length === 0) return null

  if (isFetching) {
    return (
      <View style={styles.resultRow}>
        <Text
          style={{
            color: isDark ? colors.gray[400] : colors.gray[500],
            fontSize: 13,
          }}
        >
          {t('searching')}
        </Text>
      </View>
    )
  }

  if (!fetchedVoucher) {
    return (
      <View style={styles.resultRow}>
        <Text style={{ color: colors.destructive.light, fontSize: 13 }}>
          {t('codeNotFound', { code: searchCode })}
        </Text>
      </View>
    )
  }

  if (!processedFetched) return null

  // Mã không dùng được cư xử như danh sách "Không khả dụng": mờ, không chọn
  // được, chỉ mở Điều kiện để xem lý do. Cho chọn thì khách bấm "Áp dụng" rồi
  // chỉ nhận toast chung "Voucher không hợp lệ" từ máy chủ.
  const { isValid } = processedFetched

  return (
    <View style={isValid ? undefined : styles.unavailable}>
      <VoucherCard
        voucher={fetchedVoucher}
        isSelected={isValid && selectedVoucher?.slug === fetchedVoucher.slug}
        primaryColor={primaryColor}
        isDark={isDark}
        onSelect={isValid ? onSelect : noop}
        onViewCondition={onViewCondition}
        expiryText={processedFetched.expiryText}
        discountLabel={processedFetched.discountLabel}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  resultRow: { marginTop: 14 },
  unavailable: { opacity: 0.5 },
})
