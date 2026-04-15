import { Image as ExpoImage } from 'expo-image'
import React, { useMemo } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { Images } from '@/assets/images'
import { APPLICABILITY_RULE, colors, publicFileURL, VOUCHER_TYPE } from '@/constants'
import type { IOrderItems } from '@/types'
import { calculateOrderDisplayAndTotals, capitalizeFirstLetter, formatCurrency } from '@/utils'

export type DisplayItemData = ReturnType<typeof calculateOrderDisplayAndTotals>['displayItems'][number]

export const PaymentProductItem = React.memo(function PaymentProductItem({
  item,
  displayItem,
  voucher,
  primaryColor,
  isDark,
  isLast,
  noNoteLabel,
}: {
  item: IOrderItems
  displayItem: DisplayItemData | null
  voucher: { type?: string; applicabilityRule?: string; voucherProducts?: { product?: { slug?: string } }[] } | null
  primaryColor: string
  isDark: boolean
  isLast: boolean
  noNoteLabel: string
}) {
  const { displayPrice, shouldShowLineThrough, original } = useMemo(() => {
    const orig = item.variant?.price || 0
    const priceAfterPromotion = displayItem?.priceAfterPromotion || 0
    const finalPrice = displayItem?.finalPrice || 0
    const productSlug = item.variant?.product?.slug

    const isSamePrice =
      voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
      voucher?.voucherProducts?.some((vp) => vp.product?.slug === productSlug)
    const isAtLeastOne =
      voucher?.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED &&
      voucher?.voucherProducts?.some((vp) => vp.product?.slug === productSlug)
    const hasVoucher = (displayItem?.voucherDiscount ?? 0) > 0
    const hasPromo = (displayItem?.promotionDiscount ?? 0) > 0

    const price = isSamePrice
      ? finalPrice * item.quantity
      : isAtLeastOne && hasVoucher
        ? (orig - (displayItem?.voucherDiscount || 0)) * item.quantity
        : hasPromo
          ? priceAfterPromotion * item.quantity
          : orig * item.quantity

    return {
      displayPrice: price,
      shouldShowLineThrough: isSamePrice || hasPromo || hasVoucher,
      original: orig,
    }
  }, [item.variant, item.quantity, displayItem, voucher])

  return (
    <View style={!isLast ? [pItemStyles.row, pItemStyles.rowBorder, { borderBottomColor: isDark ? colors.border.dark : colors.border.light }] : pItemStyles.row}>
      <View style={pItemStyles.contentRow}>
        <View style={pItemStyles.imageWrap}>
          <ExpoImage
            source={
              item.variant?.product?.image
                ? { uri: `${publicFileURL}/${item.variant.product.image}` }
                : Images.Food.ProductImage
            }
            style={pItemStyles.image}
            contentFit="cover"
            cachePolicy="disk"
          />
          <View style={[pItemStyles.qtyBadge, { backgroundColor: primaryColor }]}>
            <Text style={pItemStyles.qtyText}>x{item.quantity}</Text>
          </View>
        </View>

        <View style={pItemStyles.info}>
          <Text style={[pItemStyles.name, { color: isDark ? colors.gray[50] : colors.gray[900] }]} numberOfLines={2}>
            {capitalizeFirstLetter(item.variant?.product?.name || '')}
          </Text>
          <View style={[pItemStyles.sizeBadge, { borderColor: primaryColor, backgroundColor: isDark ? colors.gray[800] : `${primaryColor}18` }]}>
            <Text style={[pItemStyles.sizeText, { color: primaryColor }]} numberOfLines={1}>
              {capitalizeFirstLetter(item.variant?.size?.name || '')}
            </Text>
          </View>
        </View>

        <View style={pItemStyles.priceCol}>
          {shouldShowLineThrough && (
            <Text style={[pItemStyles.priceStrike, { color: isDark ? colors.gray[500] : colors.gray[400] }]}>{formatCurrency(original * item.quantity)}</Text>
          )}
          <Text style={[pItemStyles.priceMain, { color: primaryColor }]}>{formatCurrency(displayPrice)}</Text>
        </View>
      </View>

      {item.note ? (
        <View style={[pItemStyles.noteWrap, { backgroundColor: isDark ? colors.gray[700] : colors.gray[50] }]}>
          <TextInput
            value={item.note}
            editable={false}
            multiline
            style={[pItemStyles.noteInput, { color: isDark ? colors.gray[400] : colors.gray[600] }]}
            placeholder={noNoteLabel}
          />
        </View>
      ) : null}
    </View>
  )
})

export const pItemStyles = StyleSheet.create({
  row: {},
  rowBorder: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  contentRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  imageWrap: { position: 'relative', width: 64, height: 64 },
  image: { width: 64, height: 64, borderRadius: 8 },
  qtyBadge: { position: 'absolute', right: -8, bottom: -8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  sizeBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  sizeText: { fontSize: 12, fontWeight: '500' },
  priceCol: { alignItems: 'flex-end' },
  priceStrike: { fontSize: 14, textDecorationLine: 'line-through', marginBottom: 2 },
  priceMain: { fontSize: 14, fontWeight: '600' },
  noteWrap: { marginTop: 8, borderRadius: 8 },
  noteInput: { width: '100%', fontSize: 12, padding: 8, fontFamily: 'BeVietnamPro_400Regular' },
})
