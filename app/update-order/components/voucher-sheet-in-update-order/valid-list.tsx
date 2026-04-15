import { VoucherCard } from '@/components/cart/voucher-card'
import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { Pressable, StyleSheet, Text, View } from 'react-native'

type ValidListProps = {
  vouchers: ProcessedVoucher[]
  selectedVoucher: IVoucher | null
  onSelect: (slug: string) => void
  onViewCondition: (v: IVoucher) => void
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
  isDark: boolean
  primaryColor: string
}

export function ValidList({
  vouchers,
  selectedVoucher,
  onSelect,
  onViewCondition,
  isLoading,
  hasMore,
  onLoadMore,
  isDark,
  primaryColor,
}: ValidListProps) {
  if (vouchers.length === 0 && !isLoading) return null

  return (
    <>
      {vouchers.length > 0 && (
        <View style={styles.listHeader}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: isDark ? colors.gray[50] : colors.gray[900],
            }}
          >
            Voucher khả dụng
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isDark ? colors.gray[400] : colors.gray[500],
            }}
          >
            Tối đa: 1
          </Text>
        </View>
      )}
      {vouchers.slice(0, 10).map((p) => (
        <VoucherCard
          key={p.voucher.slug}
          voucher={p.voucher}
          isSelected={selectedVoucher?.slug === p.voucher.slug}
          primaryColor={primaryColor}
          isDark={isDark}
          onSelect={onSelect}
          onViewCondition={onViewCondition}
          discountLabel={p.discountLabel}
          expiryText={p.expiryText}
          minOrderText={p.minOrderText}
          usagePercent={p.usagePercent}
        />
      ))}
      {isLoading && (
        <Text
          style={{
            textAlign: 'center',
            marginTop: 16,
            fontSize: 13,
            color: isDark ? colors.gray[400] : colors.gray[500],
          }}
        >
          Đang tải voucher...
        </Text>
      )}
      {hasMore && !isLoading && (
        <Pressable onPress={onLoadMore} style={styles.loadMoreBtn}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: primaryColor }}>
            Tải thêm
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
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
})
