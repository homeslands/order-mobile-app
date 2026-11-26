/**
 * Tuỳ chọn đơn ở giỏ hàng — loại đơn, bàn, thông tin giao hàng, giờ lấy,
 * voucher. Nằm trong nội dung cuộn (dưới danh sách món), để thanh dưới cố định
 * chỉ còn tổng tiền + Đặt hàng và danh sách món có nhiều chỗ hơn.
 *
 * Sheet mở qua useCartSheetStore; CartFooter giữ và hiển thị các sheet.
 */
import { formatCurrencyNative } from 'cart-price-calc'
import { ChevronRight, ShoppingBag, Ticket } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'

import { DeliveryInfoRow } from '@/components/delivery'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { tablesQueryOptions } from '@/hooks/use-table'
import { useBranchStore } from '@/stores'
import { useCartVoucher, useCartVoucherDiscount } from '@/stores/cart.store'
import { useCartSheetStore } from '@/stores/cart-sheet.store'
import { useOrderFlowCartFooterData } from '@/stores/selectors/order-flow.selectors'

import { PickupTimeChips } from './pickup-time-chips'

export const CartOrderOptions = memo(function CartOrderOptions({
  isDark,
  primaryColor,
}: {
  isDark: boolean
  primaryColor: string
}) {
  const { t } = useTranslation('menu')
  const open = useCartSheetStore((s) => s.open)
  const voucher = useCartVoucher()
  const voucherDiscount = useCartVoucherDiscount()
  const {
    type: orderType,
    tableName,
    deliveryAddress,
    deliveryPhone,
  } = useOrderFlowCartFooterData()

  // Chọn "Tại bàn" là tải trước danh sách bàn — sheet chọn bàn mở ra có ngay
  // thay vì vòng quay "Đang tải" (sheet chỉ tự tải khi đã mở).
  const queryClient = useQueryClient()
  const branchSlug = useBranchStore((s) => s.branch?.slug)
  useEffect(() => {
    if (orderType !== 'at-table' || !branchSlug) return
    void queryClient.prefetchQuery(tablesQueryOptions(branchSlug))
  }, [orderType, branchSlug, queryClient])

  const openOrderType = useCallback(() => open('orderType'), [open])
  const openTable = useCallback(() => open('table'), [open])
  const openDelivery = useCallback(() => open('delivery'), [open])
  const openVoucher = useCallback(() => open('voucher'), [open])

  const orderTypeLabel =
    orderType === 'take-out'
      ? t('menu.takeAway')
      : orderType === 'delivery'
        ? t('menu.delivery')
        : t('menu.dineIn')

  const c = useMemo(
    () => ({
      cardBg: isDark ? colors.card.dark : colors.white.light,
      border: isDark ? colors.border.dark : colors.gray[200],
      text: isDark ? colors.gray[50] : colors.gray[900],
      muted: isDark ? colors.gray[400] : colors.gray[500],
      // Chưa chọn bàn: viền đỏ nhạt để khách thấy còn thiếu
      missing: isDark ? colors.destructive.dark : colors.destructive.light,
    }),
    [isDark],
  )

  return (
    <View style={s.wrapper}>
      <View style={[s.card, { backgroundColor: c.cardBg }]}>
        <View style={s.selectRow}>
          <Pressable
            onPress={openOrderType}
            accessibilityRole="button"
            style={[s.selectBtn, { borderColor: c.border }]}
          >
            <ShoppingBag size={14} color={c.muted} />
            <Text style={[s.selectText, { color: c.text }]} numberOfLines={1}>
              {orderTypeLabel}
            </Text>
            <ChevronRight size={14} color={c.muted} />
          </Pressable>
          {orderType === 'at-table' && (
            <Pressable
              onPress={openTable}
              accessibilityRole="button"
              style={[
                s.selectBtn,
                { borderColor: tableName ? c.border : c.missing },
              ]}
            >
              <Text
                style={[s.selectText, { color: tableName ? c.text : c.muted }]}
                numberOfLines={1}
              >
                {tableName || t('menu.selectTable', 'Chọn bàn')}
              </Text>
              <ChevronRight size={14} color={c.muted} />
            </Pressable>
          )}
        </View>

        {orderType === 'delivery' && (
          <DeliveryInfoRow
            address={deliveryAddress ?? ''}
            phone={deliveryPhone ?? ''}
            onPress={openDelivery}
            isDark={isDark}
          />
        )}

        {/* Tự ẩn khi không phải mang đi */}
        <PickupTimeChips isDark={isDark} primaryColor={primaryColor} />

        <Pressable
          onPress={openVoucher}
          accessibilityRole="button"
          style={[s.voucherRow, { borderTopColor: c.border }]}
        >
          <Ticket size={18} color={primaryColor} />
          <Text style={[s.voucherLabel, { color: c.text }]}>
            {t('menu.voucher', 'Mã giảm giá')}
          </Text>
          {voucher ? (
            <View style={s.voucherRight}>
              <Text
                style={[s.voucherName, { color: primaryColor }]}
                numberOfLines={1}
              >
                {voucher.title}
              </Text>
              {voucherDiscount > 0 && (
                <Text style={[s.voucherDiscount, { color: primaryColor }]}>
                  -{formatCurrencyNative(voucherDiscount)}
                </Text>
              )}
            </View>
          ) : (
            <Text style={[s.voucherHint, { color: c.muted }]}>
              {t('menu.selectVoucher')}
            </Text>
          )}
          <ChevronRight size={18} color={c.muted} />
        </Pressable>
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  wrapper: { marginTop: 16 },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  selectRow: { flexDirection: 'row', gap: 8 },
  selectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectText: { flex: 1, fontSize: 13, fontWeight: '500' },
  voucherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  voucherLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  voucherRight: { alignItems: 'flex-end', maxWidth: 160 },
  voucherName: { fontSize: 13, fontWeight: '600' },
  voucherDiscount: { fontSize: 11, fontWeight: '700' },
  voucherHint: { fontSize: 13 },
})
