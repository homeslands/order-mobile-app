/**
 * GiftCardSelectedSheet — bottom sheet chọn số lượng + add to cart.
 *
 * Patterns tuân theo:
 * - snapPoints hardcoded, enableDynamicSizing: false
 * - renderBackdrop memoized với useCallback
 * - visible → expand/close qua useEffect + ref
 * - unmount khi !visible (return null)
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { Gift, Minus, Plus } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { useGiftCardStore } from '@/stores'
import { IGiftCard } from '@/types'
import { formatCurrency, formatPoints } from '@/utils'
import { GiftCardExistsWarningDialog } from './gift-card-exists-warning-dialog'

interface GiftCardSelectedSheetProps {
  visible: boolean
  card: IGiftCard | null
  primaryColor: string
  onClose: () => void
  onAdded: () => void
}

const SNAP_POINTS = ['70%']
const MIN_QTY = 1
const MAX_QTY = 10

export const GiftCardSelectedSheet = memo(function GiftCardSelectedSheet({
  visible,
  card,
  primaryColor,
  onClose,
  onAdded,
}: GiftCardSelectedSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom: bottomInset } = useSafeAreaInsets()
  const [quantity, setQuantity] = useState(1)
  const [showWarning, setShowWarning] = useState(false)

  const { t } = useTranslation('giftCard')
  const existingItem = useGiftCardStore((s) => s.giftCardItem)
  const setGiftCardItem = useGiftCardStore((s) => s.setGiftCardItem)
  const clearGiftCard = useGiftCardStore((s) => s.clearGiftCard)

  // Reset quantity when sheet opens (React "adjust state during render" pattern)
  const [prevVisible, setPrevVisible] = useState(visible)
  if (visible !== prevVisible) {
    setPrevVisible(visible)
    if (visible) setQuantity(1)
  }

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="none"
        onPress={onClose}
      />
    ),
    [onClose],
  )

  const handleDecrement = useCallback(() => {
    setQuantity((q) => Math.max(MIN_QTY, q - 1))
  }, [])

  const handleIncrement = useCallback(() => {
    setQuantity((q) => Math.min(MAX_QTY, q + 1))
  }, [])

  const handleAddToCart = useCallback(() => {
    if (!card) return
    // Different gift card already in cart → show warning
    if (existingItem && existingItem.slug !== card.slug) {
      setShowWarning(true)
      return
    }
    setGiftCardItem({
      id: card.slug,
      slug: card.slug,
      title: card.title,
      image: card.image,
      description: card.description,
      points: card.points,
      price: card.price,
      quantity,
      isActive: card.isActive,
      version: card.version,
    })
    onAdded()
  }, [card, existingItem, quantity, setGiftCardItem, onAdded])

  const handleReplace = useCallback(() => {
    if (!card) return
    clearGiftCard(false)
    setGiftCardItem({
      id: card.slug,
      slug: card.slug,
      title: card.title,
      image: card.image,
      description: card.description,
      points: card.points,
      price: card.price,
      quantity,
      isActive: card.isActive,
      version: card.version,
    })
    setShowWarning(false)
    onAdded()
  }, [card, quantity, clearGiftCard, setGiftCardItem, onAdded])

  const handleCancelReplace = useCallback(() => {
    setShowWarning(false)
  }, [])

  const bgStyle = useMemo(() => ({ backgroundColor: colors.white.light }), [])

  const totalAmount = card ? card.price * quantity : 0
  const totalPoints = card ? card.points * quantity : 0

  if (!card) return null

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={bgStyle}
        handleIndicatorStyle={{ backgroundColor: colors.gray[300] }}
        onDismiss={onClose}
      >
        <View style={[s.sheetInner, { paddingBottom: bottomInset + 16 }]}>
          {/* Card preview */}
          <View style={s.cardPreview}>
            <Image
              source={{ uri: card.image }}
              style={s.previewImage}
              contentFit="cover"
              transition={150}
            />
            <View style={s.previewInfo}>
              <Text style={s.previewTitle} numberOfLines={2}>
                {card.title}
              </Text>
              <View style={s.pointsRow}>
                <Gift size={14} color={primaryColor} />
                <Text style={[s.pointsLabel, { color: primaryColor }]}>
                  {t('selectedSheet.pointsPerCard', {
                    points: formatPoints(card.points),
                  })}
                </Text>
              </View>
              <Text style={s.previewPrice}>
                {t('selectedSheet.pricePerCard', {
                  price: formatCurrency(card.price),
                })}
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Quantity selector */}
          <View style={s.qtySection}>
            <Text style={s.qtyLabel}>{t('selectedSheet.quantity')}</Text>
            <View style={s.qtyControls}>
              <Pressable
                onPress={handleDecrement}
                disabled={quantity <= MIN_QTY}
                style={[s.qtyBtn, quantity <= MIN_QTY && s.qtyBtnDisabled]}
              >
                <Minus
                  size={18}
                  color={
                    quantity <= MIN_QTY ? colors.gray[400] : colors.gray[700]
                  }
                />
              </Pressable>
              <Text style={s.qtyValue}>{quantity}</Text>
              <Pressable
                onPress={handleIncrement}
                disabled={quantity >= MAX_QTY}
                style={[s.qtyBtn, quantity >= MAX_QTY && s.qtyBtnDisabled]}
              >
                <Plus
                  size={18}
                  color={
                    quantity >= MAX_QTY ? colors.gray[400] : colors.gray[700]
                  }
                />
              </Pressable>
            </View>
          </View>

          <View style={s.divider} />

          {/* Total summary */}
          <View style={s.summary}>
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>{t('selectedSheet.totalAmount')}</Text>
              <Text style={s.summaryValue}>{formatCurrency(totalAmount)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>
                {t('selectedSheet.pointsEarned')}
              </Text>
              <Text style={[s.summaryPoints, { color: primaryColor }]}>
                +{formatPoints(totalPoints)} điểm
              </Text>
            </View>
          </View>

          {/* Add to cart button */}
          <Pressable
            onPress={handleAddToCart}
            style={[s.addBtn, { backgroundColor: primaryColor }]}
          >
            <Text style={s.addBtnText}>{t('selectedSheet.addToCart')}</Text>
          </Pressable>
        </View>
      </BottomSheetModal>

      {/* Replace warning */}
      {existingItem && showWarning && (
        <GiftCardExistsWarningDialog
          open={showWarning}
          currentCard={{
            slug: existingItem.slug,
            title: existingItem.title,
            image: existingItem.image,
            description: existingItem.description ?? '',
            price: existingItem.price,
            points: existingItem.points,
            isActive: existingItem.isActive ?? true,
            version: existingItem.version ?? 1,
          }}
          currentQuantity={existingItem.quantity}
          newCard={card}
          newQuantity={quantity}
          onCancel={handleCancelReplace}
          onReplace={handleReplace}
        />
      )}
    </>
  )
})

const s = StyleSheet.create({
  sheetInner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  cardPreview: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  previewInfo: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray[900],
    lineHeight: 22,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[700],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
    marginVertical: 4,
  },
  qtySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  qtyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[800],
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.5,
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[900],
    minWidth: 28,
    textAlign: 'center',
  },
  summary: {
    paddingVertical: 16,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryKey: {
    fontSize: 14,
    color: colors.gray[500],
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray[900],
  },
  summaryPoints: {
    fontSize: 15,
    fontWeight: '700',
  },
  addBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white.light,
  },
})
