/**
 * Cart Item Row — swipeable card with image, quantity controls, price display.
 */
import { colors } from '@/constants'
import { cartActions, useCartItemVoucherDiscount } from '@/stores/cart.store'
import { capitalizeFirst } from '@/utils'
import { formatCurrencyNative } from 'cart-price-calc'
import { Image } from 'expo-image'
import { NotebookText } from 'lucide-react-native'
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { CartDisplayItem } from './cart-display-item'
import { CartSwipeable } from './cart-swipeable'

const DEBOUNCE_QTY_MS = 200

// Module-level theme constants — zero allocation per render
const THEME_LIGHT = {
  cardBg: { backgroundColor: colors.white.light },
  nameColor: { color: colors.gray[900] },
  chipBorder: { borderColor: colors.gray[300] },
  chipTextColor: { color: colors.gray[600] },
  chipArrowColor: { color: colors.gray[400] },
  origPriceColor: { color: colors.gray[400] },
  qtyBtnBorder: { borderColor: colors.gray[300] },
  qtyBtnTextColor: { color: colors.gray[700] },
  qtyTextColor: { color: colors.gray[900] },
  noteRowTheme: {
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },
  noteInputColor: { color: colors.gray[700] },
  noteIconColor: colors.gray[400],
  notePlaceholderColor: colors.gray[400],
} as const

const THEME_DARK = {
  cardBg: { backgroundColor: colors.gray[800] },
  nameColor: { color: colors.gray[50] },
  chipBorder: { borderColor: colors.gray[600] },
  chipTextColor: { color: colors.gray[300] },
  chipArrowColor: { color: colors.gray[500] },
  origPriceColor: { color: colors.gray[500] },
  qtyBtnBorder: { borderColor: colors.gray[700] },
  qtyBtnTextColor: { color: colors.gray[300] },
  qtyTextColor: { color: colors.gray[50] },
  noteRowTheme: {
    borderColor: colors.gray[700],
    backgroundColor: colors.gray[900],
  },
  noteInputColor: { color: colors.gray[200] },
  noteIconColor: colors.gray[500],
  notePlaceholderColor: colors.gray[600],
} as const

export { calcItemVoucherDiscount } from './cart-display-item'

export const CartItemRow = memo(
  function CartItemRow({
    item,
    primaryColor,
    isDark,
    onDelete,
    onSizePress,
  }: {
    item: CartDisplayItem
    primaryColor: string
    isDark: boolean
    onDelete: (cartKey?: string) => void
    onSizePress?: (cartKey: string) => void
  }) {
    const { t } = useTranslation('menu')
    const voucherDiscountPerUnit = useCartItemVoucherDiscount(item.cartKey)
    const updateQuantity = cartActions.updateQuantity

    const [pendingQty, setPendingQty] = useState<number | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Display: pending (optimistic) or actual
    const displayQty = pendingQty ?? item.quantity

    const scheduleSync = useCallback(
      (qty: number) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          updateQuantity(item.cartKey, qty)
          setPendingQty(null)
          debounceRef.current = null
        }, DEBOUNCE_QTY_MS)
      },
      [item.cartKey, updateQuantity],
    )

    const handleIncrease = useCallback(() => {
      const next = displayQty + 1
      setPendingQty(next)
      scheduleSync(next)
    }, [displayQty, scheduleSync])

    const handleDecrease = useCallback(() => {
      if (displayQty <= 1) return
      const next = displayQty - 1
      setPendingQty(next)
      scheduleSync(next)
    }, [displayQty, scheduleSync])

    const hasPromotion = item.promotionValue > 0
    const hasVoucherDiscount = voucherDiscountPerUnit > 0
    const priceAfterVoucher = item.price - voucherDiscountPerUnit
    const lineTotal =
      (hasVoucherDiscount ? priceAfterVoucher : item.price) * displayQty
    const lineTotalBeforeVoucher = item.price * displayQty

    const [localNote, setLocalNote] = useState(item.note)
    const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleNoteChange = useCallback(
      (text: string) => {
        setLocalNote(text)
        if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current)
        noteDebounceRef.current = setTimeout(() => {
          cartActions.addNote(item.cartKey, text)
          noteDebounceRef.current = null
        }, 400)
      },
      [item.cartKey],
    )

    // Cleanup pending timers on unmount — both qty debounce and note debounce
    // could fire after the row is unmounted (FlashList recycling or delete).
    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
        if (noteDebounceRef.current) {
          clearTimeout(noteDebounceRef.current)
          noteDebounceRef.current = null
        }
      }
    }, [])

    const handleSizePress = useCallback(() => {
      onSizePress?.(item.cartKey)
    }, [onSizePress, item.cartKey])

    // Module-level constants — zero allocation, stable refs across renders
    const themeStyles = isDark ? THEME_DARK : THEME_LIGHT

    const priceStyle = useMemo(
      () => [rowStyles.price, { color: primaryColor }],
      [primaryColor],
    )

    return (
      <CartSwipeable itemId={item.cartKey} onDelete={onDelete}>
        <View style={[rowStyles.card, themeStyles.cardBg]}>
          {/* Top row: image + info */}
          <View style={rowStyles.topRow}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={rowStyles.image}
                contentFit="cover"
                recyclingKey={item.cartKey}
                cachePolicy="disk"
                placeholder={{ blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH' }}
                transition={0}
                priority="high"
              />
            ) : (
              <View style={[rowStyles.image, rowStyles.imagePlaceholder]} />
            )}

            <View style={rowStyles.info}>
              <Text
                style={[rowStyles.name, themeStyles.nameColor]}
                numberOfLines={1}
              >
                {capitalizeFirst(item.name)}
              </Text>
              {item.sizeName ? (
                <View style={rowStyles.sizeChipWrap}>
                  <Pressable
                    onPress={handleSizePress}
                    hitSlop={4}
                    style={[rowStyles.sizeChip, themeStyles.chipBorder]}
                  >
                    <Text
                      style={[
                        rowStyles.sizeChipText,
                        themeStyles.chipTextColor,
                      ]}
                      numberOfLines={1}
                    >
                      {capitalizeFirst(item.sizeName)}
                    </Text>
                    <Text
                      style={[
                        rowStyles.sizeChipArrow,
                        themeStyles.chipArrowColor,
                      ]}
                    >
                      ▾
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={rowStyles.bottomRow}>
                <View style={rowStyles.priceCol}>
                  <Text style={priceStyle}>
                    {formatCurrencyNative(lineTotal)}
                  </Text>
                  {(hasPromotion || hasVoucherDiscount) && (
                    <Text
                      style={[
                        rowStyles.originalPrice,
                        themeStyles.origPriceColor,
                      ]}
                    >
                      {formatCurrencyNative(
                        hasVoucherDiscount
                          ? lineTotalBeforeVoucher
                          : item.originalPrice * displayQty,
                      )}
                    </Text>
                  )}
                </View>

                <View style={rowStyles.qtyRow}>
                  <Pressable
                    onPress={handleDecrease}
                    disabled={displayQty <= 1}
                    style={[
                      rowStyles.qtyBtn,
                      themeStyles.qtyBtnBorder,
                      displayQty <= 1 && rowStyles.qtyBtnDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        rowStyles.qtyBtnText,
                        themeStyles.qtyBtnTextColor,
                      ]}
                    >
                      −
                    </Text>
                  </Pressable>
                  <Text style={[rowStyles.qtyText, themeStyles.qtyTextColor]}>
                    {displayQty}
                  </Text>
                  <Pressable
                    onPress={handleIncrease}
                    style={[rowStyles.qtyBtn, themeStyles.qtyBtnBorder]}
                  >
                    <Text
                      style={[
                        rowStyles.qtyBtnText,
                        themeStyles.qtyBtnTextColor,
                      ]}
                    >
                      +
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Note input — full width bottom */}
          <View style={[rowStyles.noteRow, themeStyles.noteRowTheme]}>
            <View style={rowStyles.noteIconWrap}>
              <NotebookText size={12} color={themeStyles.noteIconColor} />
            </View>
            <TextInput
              value={localNote}
              onChangeText={handleNoteChange}
              placeholder={t('cart.itemNotePlaceholder')}
              placeholderTextColor={themeStyles.notePlaceholderColor}
              style={[rowStyles.noteInput, themeStyles.noteInputColor]}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </View>
      </CartSwipeable>
    )
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.primaryColor === next.primaryColor &&
    prev.isDark === next.isDark &&
    prev.onDelete === next.onDelete &&
    prev.onSizePress === next.onSizePress,
)

const rowStyles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
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
  size: {
    fontSize: 12,
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
  sizeChipArrow: {
    fontSize: 8,
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
  qtyBtnDisabled: {
    opacity: 0.3,
  },
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
  noteIconWrap: {
    marginTop: 1,
  },
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
