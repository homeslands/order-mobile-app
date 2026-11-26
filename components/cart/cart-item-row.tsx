/**
 * Cart Item Row — swipeable card with image, quantity controls, price display.
 */
import { colors } from '@/constants'
import { cartActions, useCartItemVoucherDiscount } from '@/stores/cart.store'
import { capitalizeFirst } from '@/utils'
import { useRecyclingState } from '@shopify/flash-list'
import { formatCurrencyNative } from 'cart-price-calc'
import { ChevronDown, Minus, NotebookText, Plus } from 'lucide-react-native'
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { MenuItemImage } from '@/components/menu/menu-item-image'

import type { CartDisplayItem } from './cart-display-item'
import { CartSwipeable } from './cart-swipeable'
import { Text } from '@/components/ui/text'

const DEBOUNCE_QTY_MS = 200
/** Ghi chú (và "Thêm ghi chú") nằm ở cột chữ: đệm ô 10 + ảnh 76 + khoảng 12 */
const NOTE_INSET = 10 + 76 + 12
/**
 * Đối số thứ hai của setter useRecyclingState: true = chỉ render lại ô này,
 * không bắt FlashList tính lại bố cục cả danh sách (mặc định). Số lượng chờ và
 * chữ ghi chú đổi mỗi phím gõ / mỗi lần +/- — như useState trước đây.
 */
const SKIP_LIST_LAYOUT = true

// Module-level theme constants — zero allocation per render
const THEME_LIGHT = {
  cardBg: { backgroundColor: colors.white.light },
  nameColor: { color: colors.gray[900] },
  chipBorder: { borderColor: colors.gray[300] },
  chipTextColor: { color: colors.gray[600] },
  chipArrowColor: { color: colors.gray[400] },
  origPriceColor: { color: colors.gray[400] },
  // Viền nhạt hơn biểu tượng một bậc: đường viền liền trông đậm hơn nét mảnh
  // của − / +, cùng mã màu thì viền nổi hơn nút.
  qtyBtnBorder: { borderColor: colors.gray[300] },
  stepperColor: colors.gray[400],
  addNoteColor: { color: colors.gray[500] },
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
  cardBg: { backgroundColor: colors.card.dark },
  nameColor: { color: colors.gray[50] },
  chipBorder: { borderColor: colors.gray[600] },
  chipTextColor: { color: colors.gray[300] },
  chipArrowColor: { color: colors.gray[500] },
  origPriceColor: { color: colors.gray[500] },
  qtyBtnBorder: { borderColor: colors.gray[600] },
  stepperColor: colors.gray[500],
  addNoteColor: { color: colors.gray[400] },
  qtyTextColor: { color: colors.gray[50] },
  noteRowTheme: {
    borderColor: colors.border.dark,
    backgroundColor: colors.background.dark,
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

    // FlashList tái dùng ô cho món khác mà không unmount — state phải reset
    // theo cartKey, nếu không món mới hiện số lượng/ghi chú của món cũ.
    const [pendingQty, setPendingQty] = useRecyclingState<number | null>(null, [
      item.cartKey,
    ])
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Display: pending (optimistic) or actual
    const displayQty = pendingQty ?? item.quantity

    const scheduleSync = useCallback(
      (qty: number) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          updateQuantity(item.cartKey, qty)
          setPendingQty(null, SKIP_LIST_LAYOUT)
          debounceRef.current = null
        }, DEBOUNCE_QTY_MS)
      },
      [item.cartKey, updateQuantity, setPendingQty],
    )

    const handleIncrease = useCallback(() => {
      const next = displayQty + 1
      setPendingQty(next, SKIP_LIST_LAYOUT)
      scheduleSync(next)
    }, [displayQty, scheduleSync, setPendingQty])

    const handleDecrease = useCallback(() => {
      if (displayQty <= 1) return
      const next = displayQty - 1
      setPendingQty(next, SKIP_LIST_LAYOUT)
      scheduleSync(next)
    }, [displayQty, scheduleSync, setPendingQty])

    const hasPromotion = item.promotionValue > 0
    const hasVoucherDiscount = voucherDiscountPerUnit > 0
    const priceAfterVoucher = item.price - voucherDiscountPerUnit
    const lineTotal =
      (hasVoucherDiscount ? priceAfterVoucher : item.price) * displayQty
    const lineTotalBeforeVoucher = item.price * displayQty

    const [localNote, setLocalNote] = useRecyclingState(item.note, [
      item.cartKey,
    ])
    const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Ô ghi chú không mở sẵn dưới mọi món: chưa có ghi chú thì chỉ một dòng
    // "Thêm ghi chú", bấm mới mở (đổi chiều cao ô → để FlashList đo lại).
    const [noteOpen, setNoteOpen] = useRecyclingState(false, [item.cartKey])
    // Đang sửa thì hiện ô nhập; đã có ghi chú thì hiện dạng chữ (chạm để
    // sửa), cùng vị trí với "Thêm ghi chú".
    const showNoteInput = noteOpen
    const openNote = useCallback(() => setNoteOpen(true), [setNoteOpen])
    const handleNoteBlur = useCallback(() => setNoteOpen(false), [setNoteOpen])

    const handleNoteChange = useCallback(
      (text: string) => {
        setLocalNote(text, SKIP_LIST_LAYOUT)
        if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current)
        noteDebounceRef.current = setTimeout(() => {
          cartActions.addNote(item.cartKey, text)
          noteDebounceRef.current = null
        }, 400)
      },
      [item.cartKey, setLocalNote],
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
            {/* Cùng pipeline ảnh với Menu: thumbnail thu nhỏ trên máy (BE chưa
                resize — URL là ảnh gốc ~1080px), cache bộ nhớ, khoá theo ô. */}
            <View style={rowStyles.image}>
              <MenuItemImage
                id={item.cartKey}
                imageUrl={item.imageUrl}
                priority="high"
                borderRadius={rowStyles.image.borderRadius}
              />
            </View>

            <View style={rowStyles.info}>
              <Text
                style={[rowStyles.name, themeStyles.nameColor]}
                numberOfLines={1}
              >
                {capitalizeFirst(item.name)}
              </Text>
              {/* Một size: chỉ ghi tên size (mũi tên gợi ý có lựa chọn khác) */}
              {item.sizeName && !item.hasSizeChoice ? (
                <Text
                  style={[rowStyles.sizePlain, themeStyles.chipTextColor]}
                  numberOfLines={1}
                >
                  {capitalizeFirst(item.sizeName)}
                </Text>
              ) : null}
              {item.sizeName && item.hasSizeChoice ? (
                <View style={rowStyles.sizeChipWrap}>
                  <Pressable
                    onPress={handleSizePress}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={t('cart.changeSize')}
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
                    <ChevronDown
                      size={12}
                      color={themeStyles.chipArrowColor.color}
                    />
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

                {/* Hai nút tròn riêng − / +, số ở giữa */}
                <View style={rowStyles.stepper}>
                  {/* Chỉ − / + (xoá món bằng vuốt); SL 1 thì − tắt */}
                  <Pressable
                    onPress={handleDecrease}
                    disabled={displayQty <= 1}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('cart.decreaseQty')}
                    accessibilityState={{ disabled: displayQty <= 1 }}
                    style={[
                      rowStyles.stepBtn,
                      themeStyles.qtyBtnBorder,
                      displayQty <= 1 && rowStyles.stepBtnDisabled,
                    ]}
                  >
                    <Minus size={16} color={themeStyles.stepperColor} />
                  </Pressable>
                  <Text style={[rowStyles.qtyText, themeStyles.qtyTextColor]}>
                    {displayQty}
                  </Text>
                  <Pressable
                    onPress={handleIncrease}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('cart.increaseQty')}
                    style={[rowStyles.stepBtn, themeStyles.qtyBtnBorder]}
                  >
                    <Plus size={16} color={themeStyles.stepperColor} />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Ghi chú món: chưa có thì một dòng "Thêm ghi chú"; có rồi thì hiện
              ghi chú, sửa ngay tại chỗ. */}
          {showNoteInput ? (
            <View style={[rowStyles.noteRow, themeStyles.noteRowTheme]}>
              <NotebookText size={12} color={themeStyles.noteIconColor} />
              <TextInput
                value={localNote}
                onChangeText={handleNoteChange}
                onBlur={handleNoteBlur}
                autoFocus
                placeholder={t('cart.itemNotePlaceholder')}
                placeholderTextColor={themeStyles.notePlaceholderColor}
                style={[rowStyles.noteInput, themeStyles.noteInputColor]}
                multiline
                textAlignVertical="top"
              />
            </View>
          ) : (
            <Pressable
              onPress={openNote}
              hitSlop={6}
              accessibilityRole="button"
              style={rowStyles.addNoteRow}
            >
              <NotebookText size={12} color={themeStyles.noteIconColor} />
              {localNote ? (
                <Text
                  style={[rowStyles.noteText, themeStyles.noteInputColor]}
                  numberOfLines={2}
                >
                  {localNote}
                </Text>
              ) : (
                <Text style={[rowStyles.addNoteText, themeStyles.addNoteColor]}>
                  {t('cart.addNote')}
                </Text>
              )}
            </Pressable>
          )}
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
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 12,
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: 12,
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 16,
    textAlign: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: NOTE_INSET,
    marginRight: 10,
    marginBottom: 10,
    marginTop: -4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 10,
  },
  addNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginLeft: NOTE_INSET,
    marginRight: 10,
    marginBottom: 10,
    marginTop: -4,
  },
  addNoteText: { fontSize: 12, fontWeight: '500' },
  noteText: { flexShrink: 1, fontSize: 12 },
  sizePlain: { fontSize: 12, marginTop: 2 },
  noteInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
    fontFamily: 'BeVietnamPro_400Regular',
  },
})
