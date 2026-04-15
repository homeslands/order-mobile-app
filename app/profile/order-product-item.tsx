import { Image } from 'expo-image'
import React, { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Images } from '@/assets/images'
import { APPLICABILITY_RULE, colors, publicFileURL, VOUCHER_TYPE, paymentStatus } from '@/constants'
import type { IOrder, IOrderItems } from '@/types'
import {
  calculateOrderDisplayAndTotals,
  capitalizeFirstLetter,
  formatCurrency,
} from '@/utils'

// ─── Shared types ──────────────────────────────────────────────────────────

export type StatusBadgeColors = { bg: string; text: string }

export function getStatusBadgeColors(pStatus: string | undefined): StatusBadgeColors {
  if (pStatus === paymentStatus.COMPLETED) {
    return { bg: colors.success.light, text: colors.white.light }
  }
  return { bg: '#eab308', text: colors.white.light }
}

export type OrderDisplayData = {
  displayItemMap: Map<string, ReturnType<typeof calculateOrderDisplayAndTotals>['displayItems'][number]>
  cartTotals: ReturnType<typeof calculateOrderDisplayAndTotals>['cartTotals']
}

// ─── OrderProductItem (memo'd) ──────────────────────────────────────────────

const OrderProductItem = memo(function OrderProductItem({
  product,
  displayData,
  voucher,
  primaryColor,
  isDark,
  isLast,
}: {
  product: IOrderItems
  displayData: OrderDisplayData | null
  voucher: IOrder['voucher']
  primaryColor: string
  isDark: boolean
  isLast: boolean
}) {
  const displayItem = displayData?.displayItemMap.get(product.slug) ?? null
  const original = product.variant?.price || 0
  const priceAfterPromotion = displayItem?.priceAfterPromotion || 0
  const finalPrice = displayItem?.finalPrice || 0

  const isSamePriceVoucher =
    voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
    voucher?.voucherProducts?.some(
      (vp) => vp.product?.slug === product.variant?.product?.slug,
    )
  const isAtLeastOneVoucher =
    voucher?.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED &&
    voucher?.voucherProducts?.some(
      (vp) => vp.product?.slug === product.variant?.product?.slug,
    )
  const hasVoucherDiscount = (displayItem?.voucherDiscount ?? 0) > 0
  const hasPromotionDiscount = (displayItem?.promotionDiscount ?? 0) > 0

  const displayPrice = isSamePriceVoucher
    ? finalPrice
    : isAtLeastOneVoucher && hasVoucherDiscount
      ? original - (displayItem?.voucherDiscount || 0)
      : hasPromotionDiscount
        ? priceAfterPromotion
        : original

  const shouldShowLineThrough =
    (isSamePriceVoucher || hasPromotionDiscount || hasVoucherDiscount) &&
    original > displayPrice

  return (
    <View style={[productStyles.productRow, !isLast && productStyles.productRowBorder]}>
      <View style={productStyles.productImageWrap}>
        <Image
          source={
            product.variant?.product?.image
              ? { uri: `${publicFileURL}/${product.variant.product.image}` }
              : Images.Food.ProductImage
          }
          style={productStyles.productImage}
          contentFit="cover"
          cachePolicy="disk"
        />
        <View style={[productStyles.qtyBadge, { backgroundColor: primaryColor }]}>
          <Text style={productStyles.qtyText}>x{product.quantity}</Text>
        </View>
      </View>

      <View style={productStyles.productInfo}>
        <Text
          style={[productStyles.productName, { color: isDark ? colors.gray[50] : colors.gray[900] }]}
          numberOfLines={2}
        >
          {capitalizeFirstLetter(product.variant?.product?.name || '')}
        </Text>
        <View style={[productStyles.sizeBadge, { borderColor: primaryColor, backgroundColor: isDark ? colors.gray[800] : `${primaryColor}18` }]}>
          <Text style={[productStyles.sizeText, { color: primaryColor }]}>
            {capitalizeFirstLetter(product.variant?.size?.name || '')}
          </Text>
        </View>
        <View style={productStyles.priceRow}>
          {shouldShowLineThrough && (
            <Text style={productStyles.priceStrike}>
              {formatCurrency(original * product.quantity)}
            </Text>
          )}
          <Text style={[productStyles.priceMain, { color: primaryColor }]}>
            {formatCurrency(displayPrice * product.quantity)}
          </Text>
        </View>
      </View>
    </View>
  )
})

export const productStyles = StyleSheet.create({
  productRow: { flexDirection: 'row', gap: 12 },
  productRowBorder: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.light },
  productImageWrap: { position: 'relative' },
  productImage: { width: 64, height: 64, borderRadius: 8 },
  qtyBadge: { position: 'absolute', bottom: -2, right: -8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 10, fontWeight: '700', color: colors.white.light },
  productInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 14, fontWeight: '600' },
  sizeBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  sizeText: { fontSize: 12, fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 4 },
  priceStrike: { fontSize: 12, color: colors.mutedForeground.dark, textDecorationLine: 'line-through' },
  priceMain: { fontSize: 14, fontWeight: '700' },
})

export default OrderProductItem
