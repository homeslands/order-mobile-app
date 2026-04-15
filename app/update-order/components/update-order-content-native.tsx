import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { NotebookText } from 'lucide-react-native'
import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { APPLICABILITY_RULE, colors, publicFileURL, VOUCHER_TYPE } from '@/constants'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem } from '@/types'
import {
  calculateOrderDisplayAndTotals,
  capitalizeFirst,
  transformOrderItemToOrderDetail,
} from '@/utils'
import { formatCurrencyNative } from 'cart-price-calc'

import OrderNoteInUpdateOrderInput from './order-note-in-update-order-input'
import RemoveOrderItemInUpdateOrderDialog from './remove-order-item-in-update-order-dialog'

// ─── Module-level theme constants (zero allocation per render) ────────────────

const THEME_LIGHT = {
  cardBg: { backgroundColor: colors.white.light },
  nameColor: { color: colors.gray[900] },
  chipBorder: { borderColor: colors.gray[300] },
  chipTextColor: { color: colors.gray[600] },
  origPriceColor: { color: colors.gray[400] },
  qtyBtnBorder: { borderColor: colors.gray[300] },
  qtyBtnTextColor: { color: colors.gray[700] },
  qtyTextColor: { color: colors.gray[900] },
  noteRowTheme: { borderColor: colors.gray[200], backgroundColor: colors.gray[50] },
  noteInputColor: { color: colors.gray[700] },
  noteIconColor: colors.gray[400],
  notePlaceholderColor: colors.gray[400],
} as const

const THEME_DARK = {
  cardBg: { backgroundColor: colors.gray[800] },
  nameColor: { color: colors.gray[50] },
  chipBorder: { borderColor: colors.gray[600] },
  chipTextColor: { color: colors.gray[300] },
  origPriceColor: { color: colors.gray[500] },
  qtyBtnBorder: { borderColor: colors.gray[700] },
  qtyBtnTextColor: { color: colors.gray[300] },
  qtyTextColor: { color: colors.gray[50] },
  noteRowTheme: { borderColor: colors.gray[700], backgroundColor: colors.gray[900] },
  noteInputColor: { color: colors.gray[200] },
  noteIconColor: colors.gray[500],
  notePlaceholderColor: colors.gray[600],
} as const

const DEBOUNCE_QTY_MS = 200
const DEBOUNCE_NOTE_MS = 400
const BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH'

// ─── Order Item Row ───────────────────────────────────────────────────────────

interface OrderItemRowProps {
  item: IOrderItem
  displayItem:
    | ReturnType<typeof calculateOrderDisplayAndTotals>['displayItems'][number]
    | undefined
  primaryColor: string
  isDark: boolean
  totalOrderItems: number
  hasVoucherDiscount: (item: IOrderItem) => boolean
  hasPromotionDiscount: (item: IOrderItem) => boolean
  isSamePriceVoucher: (item: IOrderItem) => boolean
  isAtLeastOneVoucher: (item: IOrderItem) => boolean
  onQtyChange: (id: string, qty: number) => void
  onNoteChange: (id: string, note: string) => void
}

const OrderItemRow = memo(
  function OrderItemRow({
    item,
    displayItem,
    primaryColor,
    isDark,
    totalOrderItems,
    hasVoucherDiscount,
    hasPromotionDiscount,
    isSamePriceVoucher,
    isAtLeastOneVoucher,
    onQtyChange,
    onNoteChange,
  }: OrderItemRowProps) {
    const themeStyles = isDark ? THEME_DARK : THEME_LIGHT
    const priceStyle = useMemo(() => [row.price, { color: primaryColor }], [primaryColor])

    // ── Optimistic qty ──────────────────────────────────────────────────────
    const [pendingQty, setPendingQty] = useState<number | null>(null)
    const qtyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const displayQty = pendingQty ?? item.quantity

    const handleIncrease = useCallback(() => {
      const next = displayQty + 1
      setPendingQty(next)
      if (qtyDebounceRef.current) clearTimeout(qtyDebounceRef.current)
      qtyDebounceRef.current = setTimeout(() => {
        onQtyChange(item.id!, next)
        setPendingQty(null)
        qtyDebounceRef.current = null
      }, DEBOUNCE_QTY_MS)
    }, [displayQty, item.id, onQtyChange])

    const handleDecrease = useCallback(() => {
      if (displayQty <= 1) return
      const next = displayQty - 1
      setPendingQty(next)
      if (qtyDebounceRef.current) clearTimeout(qtyDebounceRef.current)
      qtyDebounceRef.current = setTimeout(() => {
        onQtyChange(item.id!, next)
        setPendingQty(null)
        qtyDebounceRef.current = null
      }, DEBOUNCE_QTY_MS)
    }, [displayQty, item.id, onQtyChange])

    // ── Optimistic note ─────────────────────────────────────────────────────
    const [localNote, setLocalNote] = useState(item.note || '')
    const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleNoteChange = useCallback(
      (text: string) => {
        setLocalNote(text)
        if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current)
        noteDebounceRef.current = setTimeout(() => {
          onNoteChange(item.id!, text)
          noteDebounceRef.current = null
        }, DEBOUNCE_NOTE_MS)
      },
      [item.id, onNoteChange],
    )

    // ── Price calculation ───────────────────────────────────────────────────
    const original = item.originalPrice ?? 0
    const priceAfterPromotion = displayItem?.priceAfterPromotion ?? 0
    const finalPrice = displayItem?.finalPrice ?? 0

    const _isSamePrice = isSamePriceVoucher(item)
    const _isAtLeastOne = isAtLeastOneVoucher(item)
    const _hasVoucher = hasVoucherDiscount(item)
    const _hasPromotion = hasPromotionDiscount(item)

    const displayUnitPrice = _isSamePrice
      ? finalPrice
      : _isAtLeastOne && _hasVoucher
        ? original - (displayItem?.voucherDiscount ?? 0)
        : _hasPromotion
          ? priceAfterPromotion
          : original

    const showLineThrough =
      (_isSamePrice || _hasPromotion || _hasVoucher) && original > displayUnitPrice

    const lineTotal = displayUnitPrice * displayQty
    const lineTotalOriginal = original * displayQty

    const imageUrl = item.image ? `${publicFileURL}/${item.image}` : null

    return (
      <View style={[row.card, themeStyles.cardBg]}>
        {/* Top row: image + info */}
        <View style={row.topRow}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={row.image}
              contentFit="cover"
              recyclingKey={item.slug}
              cachePolicy="disk"
              placeholder={{ blurhash: BLURHASH }}
              transition={0}
              priority="high"
            />
          ) : (
            <View style={[row.image, row.imagePlaceholder]} />
          )}

          <View style={row.info}>
            <Text style={[row.name, themeStyles.nameColor]} numberOfLines={1}>
              {capitalizeFirst(item.name)}
            </Text>

            {item.variant?.size?.name ? (
              <View style={row.sizeChipWrap}>
                <View style={[row.sizeChip, themeStyles.chipBorder]}>
                  <Text style={[row.sizeChipText, themeStyles.chipTextColor]} numberOfLines={1}>
                    {capitalizeFirst(item.variant.size.name)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={row.bottomRow}>
              <View style={row.priceCol}>
                <Text style={priceStyle}>{formatCurrencyNative(lineTotal)}</Text>
                {showLineThrough && (
                  <Text style={[row.originalPrice, themeStyles.origPriceColor]}>
                    {formatCurrencyNative(lineTotalOriginal)}
                  </Text>
                )}
              </View>

              <View style={row.qtyRow}>
                <Pressable
                  onPress={handleDecrease}
                  disabled={displayQty <= 1}
                  style={[
                    row.qtyBtn,
                    themeStyles.qtyBtnBorder,
                    displayQty <= 1 && row.qtyBtnDisabled,
                  ]}
                >
                  <Text style={[row.qtyBtnText, themeStyles.qtyBtnTextColor]}>−</Text>
                </Pressable>
                <Text style={[row.qtyText, themeStyles.qtyTextColor]}>{displayQty}</Text>
                <Pressable onPress={handleIncrease} style={[row.qtyBtn, themeStyles.qtyBtnBorder]}>
                  <Text style={[row.qtyBtnText, themeStyles.qtyBtnTextColor]}>+</Text>
                </Pressable>
                <RemoveOrderItemInUpdateOrderDialog
                  orderItem={item}
                  totalOrderItems={totalOrderItems}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Note input — full width bottom */}
        <View style={[row.noteRow, themeStyles.noteRowTheme]}>
          <View style={row.noteIconWrap}>
            <NotebookText size={12} color={themeStyles.noteIconColor} />
          </View>
          <TextInput
            value={localNote}
            onChangeText={handleNoteChange}
            placeholder="Ghi chú món..."
            placeholderTextColor={themeStyles.notePlaceholderColor}
            style={[row.noteInput, themeStyles.noteInputColor]}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>
      </View>
    )
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.displayItem === next.displayItem &&
    prev.primaryColor === next.primaryColor &&
    prev.isDark === next.isDark &&
    prev.totalOrderItems === next.totalOrderItems &&
    prev.onQtyChange === next.onQtyChange &&
    prev.onNoteChange === next.onNoteChange,
)

// ─── Main Content ─────────────────────────────────────────────────────────────

interface UpdateOrderContentNativeProps {
  isDark: boolean
  primaryColor: string
}

export default function UpdateOrderContentNative({
  isDark,
  primaryColor,
}: UpdateOrderContentNativeProps) {
  const updatingData = useOrderFlowStore((s) => s.updatingData)
  const updateDraftItemQuantity = useOrderFlowStore((s) => s.updateDraftItemQuantity)
  const addDraftNote = useOrderFlowStore((s) => s.addDraftNote)

  const voucher = updatingData?.updateDraft?.voucher ?? null
  const orderItems = useMemo(() => updatingData?.updateDraft?.orderItems ?? [], [updatingData])

  const { displayItems } = useMemo(
    () =>
      calculateOrderDisplayAndTotals(transformOrderItemToOrderDetail(orderItems), voucher),
    [orderItems, voucher],
  )
  const displayItemMap = useMemo(() => {
    const m = new Map<string, (typeof displayItems)[number]>()
    for (const di of displayItems) m.set(di.slug, di)
    return m
  }, [displayItems])

  const isSamePriceVoucher = useCallback(
    (item: IOrderItem) =>
      voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
      (voucher?.voucherProducts?.some((vp) => vp.product?.slug === item.productSlug) ?? false),
    [voucher],
  )
  const isAtLeastOneVoucher = useCallback(
    (item: IOrderItem) =>
      voucher?.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED &&
      (voucher?.voucherProducts?.some((vp) => vp.product?.slug === item.productSlug) ?? false),
    [voucher],
  )
  const hasVoucherDiscount = useCallback(
    (item: IOrderItem) => (displayItemMap.get(item.slug)?.voucherDiscount ?? 0) > 0,
    [displayItemMap],
  )
  const hasPromotionDiscount = useCallback(
    (item: IOrderItem) => (displayItemMap.get(item.slug)?.promotionDiscount ?? 0) > 0,
    [displayItemMap],
  )

  const handleQtyChange = useCallback(
    (id: string, qty: number) => {
      scheduleStoreUpdate(() => updateDraftItemQuantity(id, qty))
    },
    [updateDraftItemQuantity],
  )
  const handleNoteChange = useCallback(
    (id: string, note: string) => {
      scheduleStoreUpdate(() => addDraftNote(id, note))
    },
    [addDraftNote],
  )

  const cardBg = isDark ? colors.gray[800] : colors.white.light
  const cardBorder = isDark ? colors.gray[700] : colors.gray[100]
  const dividerColor = isDark ? colors.gray[700] : colors.gray[100]
  const labelColor = isDark ? colors.gray[400] : colors.gray[500]
  const valueColor = isDark ? colors.gray[50] : colors.gray[900]

  const renderItem = useCallback(
    ({ item }: { item: IOrderItem }) => (
      <View style={c.itemCard}>
        <OrderItemRow
          item={item}
          displayItem={displayItemMap.get(item.slug)}
          primaryColor={primaryColor}
          isDark={isDark}
          totalOrderItems={orderItems.length}
          isSamePriceVoucher={isSamePriceVoucher}
          isAtLeastOneVoucher={isAtLeastOneVoucher}
          hasVoucherDiscount={hasVoucherDiscount}
          hasPromotionDiscount={hasPromotionDiscount}
          onQtyChange={handleQtyChange}
          onNoteChange={handleNoteChange}
        />
      </View>
    ),
    [
      displayItemMap, primaryColor, isDark, orderItems.length,
      isSamePriceVoucher, isAtLeastOneVoucher, hasVoucherDiscount, hasPromotionDiscount,
      handleQtyChange, handleNoteChange,
    ],
  )

  const keyExtractor = useCallback(
    (item: IOrderItem) => item.id ?? item.slug,
    [],
  )

  const listHeader = useMemo(
    () => (
      <View style={c.listHeader}>
        <Text style={[c.cardTitle, { color: valueColor }]}>Danh sách món</Text>
        <Text style={[c.cardSub, { color: labelColor }]}>{orderItems.length} sản phẩm</Text>
      </View>
    ),
    [valueColor, labelColor, orderItems.length],
  )

  const listFooter = useMemo(
    () => (
      <View style={[c.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={[c.cardHeader, { borderBottomColor: dividerColor }]}>
          <Text style={[c.cardTitle, { color: valueColor }]}>Ghi chú đơn hàng</Text>
        </View>
        <View style={c.cardBody}>
          <OrderNoteInUpdateOrderInput order={updatingData?.updateDraft} />
        </View>
      </View>
    ),
    [cardBg, cardBorder, dividerColor, valueColor, updatingData?.updateDraft],
  )

  return (
    <FlashList
      data={orderItems}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      overrideItemLayout={(layout: { span?: number; size?: number }) => { layout.size = 152 }}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    />
  )
}

// ─── Card styles ──────────────────────────────────────────────────────────────

const c = StyleSheet.create({
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemCard: {
    marginBottom: 10,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12 },
  cardBody: { padding: 16 },
})

// ─── Row styles (matches cart-item-row exactly) ────────────────────────────────

const row = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 12,
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: 12,
  },
  imagePlaceholder: {
    backgroundColor: colors.gray[200],
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  sizeChipWrap: {
    flexDirection: 'row',
    marginTop: 2,
  },
  sizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  sizeChipText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 16,
    textAlign: 'center',
  },
  noteIconWrap: { marginTop: 1 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 10,
  },
  noteInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
    fontFamily: 'BeVietnamPro_400Regular',
  },
})
