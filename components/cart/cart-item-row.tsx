/**
 * Cart Item Row — swipeable card with image, quantity controls, price display.
 */
import { colors } from '@/constants'
import { cartActions, useCartItemFinalPrice } from '@/stores/cart.store'
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
/**
 * Ghi chú (và "Thêm ghi chú") bắt đầu từ mép trái thẻ, thẳng mép ảnh, trải hết
 * ngang — thụt vào cột chữ thì luôn trống một khoảng dưới ảnh, lệch bố cục.
 */
const NOTE_INSET = 12
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
    // Đơn giá cuối (sau khuyến mãi / voucher) — cùng nguồn với thanh dưới
    const finalPrice = useCartItemFinalPrice(item.cartKey) ?? item.price
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

    const lineTotal = finalPrice * displayQty
    const isDiscounted = finalPrice < item.originalPrice

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
                      size={14}
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
                  {isDiscounted && (
                    <Text
                      style={[
                        rowStyles.originalPrice,
                        themeStyles.origPriceColor,
                      ]}
                    >
                      {formatCurrencyNative(item.originalPrice * displayQty)}
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
                    <Minus size={18} color={themeStyles.stepperColor} />
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
                    <Plus size={18} color={themeStyles.stepperColor} />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Ghi chú món: chưa có thì một dòng "Thêm ghi chú"; có rồi thì hiện
              ghi chú, sửa ngay tại chỗ. */}
          {showNoteInput ? (
            <View style={[rowStyles.noteRow, themeStyles.noteRowTheme]}>
              <NotebookText size={16} color={themeStyles.noteIconColor} />
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
              <NotebookText size={16} color={themeStyles.noteIconColor} />
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

// Thẻ món cỡ lớn hơn (ảnh 88, chữ 16, nút 34, dòng ghi chú cao 36): ghi chú
// từng món dễ bấm hơn, chấp nhận ít thẻ trên màn hơn.
const rowStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  size: {
    fontSize: 13,
  },
  sizeChipWrap: {
    flexDirection: 'row',
  },
  sizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sizeChipText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  qtyText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 18,
    textAlign: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: NOTE_INSET,
    marginRight: 12,
    marginBottom: 12,
    marginTop: -2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  // Cả dòng là vùng bấm (cao ≥ 36), không chỉ phần chữ
  addNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    marginLeft: NOTE_INSET,
    marginRight: 12,
    marginBottom: 8,
    marginTop: -4,
  },
  addNoteText: { fontSize: 14, fontWeight: '500' },
  noteText: { flexShrink: 1, fontSize: 14 },
  sizePlain: { fontSize: 13 },
  noteInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    fontFamily: 'BeVietnamPro_400Regular',
  },
})
