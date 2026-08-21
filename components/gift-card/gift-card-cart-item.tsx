import { Image } from 'expo-image'
import { Coins, Gift } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'

import { CartSwipeable } from '@/components/cart/cart-swipeable'
import { colors, GIFT_CARD_MAX_ORDER_AMOUNT } from '@/constants'
import { useGiftCardStore } from '@/stores'
import { capitalizeFirst, formatCurrency, formatPoints } from '@/utils'
import { getProductImageUrl, IMAGE_PRESET } from '@/utils/product-image-url'
import type { IGiftCardCartItem } from '@/types'
import { Text } from '@/components/ui/text'

const MIN_QTY = 1

const SWIPE_ID = 'gift-card-cart'

interface GiftCardCartItemProps {
  item: IGiftCardCartItem
  primaryColor: string
  isDark: boolean
  /** Khi truyền vào (GIFT mode), ghi đè qty hiển thị và disable stepper */
  overrideQty?: number
}

export const GiftCardCartItem = memo(function GiftCardCartItem({
  item,
  primaryColor,
  isDark,
  overrideQty,
}: GiftCardCartItemProps) {
  const { t } = useTranslation('giftCard')
  const cardBg = isDark ? colors.card.dark : colors.white.light
  const titleColor = isDark ? colors.gray[50] : colors.gray[900]
  const imgBg = isDark ? colors.border.dark : colors.gray[100]
  const qtyBtnBorder = isDark ? colors.border.dark : colors.gray[300]
  const qtyBtnText = isDark ? colors.gray[300] : colors.gray[700]
  const qtyText = isDark ? colors.gray[50] : colors.gray[900]

  const updateGiftCardQuantity = useGiftCardStore(
    (s) => s.updateGiftCardQuantity,
  )
  const clearGiftCard = useGiftCardStore((s) => s.clearGiftCard)

  const [pendingQty, setPendingQty] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayQty = overrideQty ?? pendingQty ?? item.quantity
  const isOverridden = overrideQty !== undefined

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const scheduleSync = useCallback(
    (qty: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateGiftCardQuantity(qty)
        setPendingQty(null)
        debounceRef.current = null
      }, 200)
    },
    [updateGiftCardQuantity],
  )

  // Không giới hạn số lượng — chỉ chặn theo trần tổng giá trị đơn.
  const handleIncrease = useCallback(() => {
    if ((displayQty + 1) * item.price > GIFT_CARD_MAX_ORDER_AMOUNT) return
    const next = displayQty + 1
    setPendingQty(next)
    scheduleSync(next)
  }, [displayQty, item.price, scheduleSync])

  const handleDecrease = useCallback(() => {
    if (displayQty <= MIN_QTY) return
    const next = displayQty - 1
    setPendingQty(next)
    scheduleSync(next)
  }, [displayQty, scheduleSync])

  const handleDelete = useCallback(() => clearGiftCard(false), [clearGiftCard])

  const totalPoints = item.points * displayQty
  const totalAmount = item.price * displayQty
  const atValueCap = (displayQty + 1) * item.price > GIFT_CARD_MAX_ORDER_AMOUNT
  const imageUrl = getProductImageUrl(item.image, {
    maxWidth: IMAGE_PRESET.THUMB,
  })

  return (
    <CartSwipeable itemId={SWIPE_ID} onDelete={handleDelete} cardMargin={0}>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        {/* Image — same layout as GiftCardListItem */}
        <View style={s.imageWrap}>
          <View style={[s.imageInner, { backgroundColor: imgBg }]}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={s.image}
                contentFit="cover"
                transition={0}
              />
            ) : (
              <View style={s.imageFallback}>
                <Gift size={28} color={colors.gray[400]} />
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={s.content}>
          <View style={s.topInfo}>
            <Text style={[s.name, { color: titleColor }]} numberOfLines={2}>
              {capitalizeFirst(item.title)}
            </Text>
            <View style={s.pointsBadge}>
              <Coins size={11} color={primaryColor} />
              <Text style={[s.pointsText, { color: primaryColor }]}>
                {formatPoints(totalPoints)}
              </Text>
            </View>
          </View>

          {/* Trần tổng giá trị đơn */}
          <Text
            style={{
              color: colors.destructive.light,
              fontStyle: 'italic',
              fontSize: 12,
            }}
          >
            {t('maxOrderNote', {
              amount: formatCurrency(GIFT_CARD_MAX_ORDER_AMOUNT),
            })}
          </Text>

          <View style={s.footer}>
            <View>
              <Text style={[s.totalPrice, { color: primaryColor }]}>
                {formatCurrency(totalAmount)}
              </Text>
              <Text
                style={[
                  s.unitPrice,
                  { color: isDark ? colors.gray[400] : colors.gray[500] },
                ]}
              >
                {formatCurrency(item.price)} / thẻ
              </Text>
            </View>

            <View style={s.qtyRow}>
              <Pressable
                onPress={handleDecrease}
                disabled={isOverridden || displayQty <= MIN_QTY}
                style={[
                  s.qtyBtn,
                  { borderColor: qtyBtnBorder },
                  (isOverridden || displayQty <= MIN_QTY) && s.qtyBtnDisabled,
                ]}
              >
                <Text style={[s.qtyBtnText, { color: qtyBtnText }]}>−</Text>
              </Pressable>
              <Text style={[s.qtyText, { color: qtyText }]}>{displayQty}</Text>
              <Pressable
                onPress={handleIncrease}
                disabled={isOverridden || atValueCap}
                style={[
                  s.qtyBtn,
                  { borderColor: qtyBtnBorder },
                  (isOverridden || atValueCap) && s.qtyBtnDisabled,
                ]}
              >
                <Text style={[s.qtyBtnText, { color: qtyBtnText }]}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </CartSwipeable>
  )
})

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageWrap: {
    width: 128,
    height: 128,
    padding: 8,
    flexShrink: 0,
  },
  imageInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  topInfo: { gap: 4 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pointsText: { fontSize: 12, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalPrice: { fontSize: 14, fontWeight: '700' },
  unitPrice: { fontSize: 11, marginTop: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyBtnText: { fontSize: 16, fontWeight: '600', lineHeight: 18 },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 16,
    textAlign: 'center',
  },
})
