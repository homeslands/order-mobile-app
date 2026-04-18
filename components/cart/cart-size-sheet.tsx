/**
 * CartSizeSheet — Lightweight bottom sheet for changing item size in cart.
 *
 * Uses Modal + BottomSheet pattern (same as ConfirmOrderSheet) for z-index safety.
 * Pure StyleSheet styling, memo'd renderItem, minimal subscriptions.
 */
import { colors } from '@/constants'
import { cartActions } from '@/stores/cart.store'
import { useOrderFlowStore } from '@/stores'
import type { IProductVariant } from '@/types'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatCurrencyNative } from 'cart-price-calc'
import { capitalizeFirst } from '@/utils'

const SIZE_SHEET_SNAP = ['40%']
const EMPTY_VARIANTS: IProductVariant[] = []

interface CartSizeSheetProps {
  visible: boolean
  itemId: string | null
  onClose: () => void
  isDark: boolean
  primaryColor: string
}

export const CartSizeSheet = memo(function CartSizeSheet({
  visible,
  itemId,
  onClose,
  isDark,
  primaryColor,
}: CartSizeSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { t } = useTranslation('product')

  // Single selector — one .find() instead of two, useShallow for stable ref
  const { variants, selectedSlug } = useOrderFlowStore(
    useShallow((s) => {
      if (!itemId) return { variants: EMPTY_VARIANTS, selectedSlug: '' }
      const item = s.orderingData?.orderItems?.find((i) => i.id === itemId)
      return {
        variants: (item?.allVariants || EMPTY_VARIANTS) as IProductVariant[],
        selectedSlug: item?.variant?.slug ?? '',
      }
    }),
  )

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  )

  useEffect(() => {
    if (visible && itemId) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible, itemId])

  const handleSelect = useCallback(
    (variant: IProductVariant) => {
      if (!itemId) return
      cartActions.updateVariant(itemId, variant)
      sheetRef.current?.dismiss()
    },
    [itemId],
  )

  // renderItem stable — selectedSlug passed via extraData, SizeOption handles isSelected
  const renderItem = useCallback(
    ({ item, extraData }: { item: IProductVariant; extraData?: string }) => (
      <SizeOption
        variant={item}
        isSelected={item.slug === extraData}
        isDark={isDark}
        primaryColor={primaryColor}
        onSelect={handleSelect}
      />
    ),
    [isDark, primaryColor, handleSelect],
  )

  const keyExtractor = useCallback((item: IProductVariant) => item.slug, [])

  if (!visible || !itemId) return null

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SIZE_SHEET_SNAP}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={onClose}
    >
      <View
        style={[
          sizeSheetStyles.header,
          {
            borderBottomColor: isDark ? colors.gray[700] : colors.border.light,
          },
        ]}
      >
        <Text
          style={[
            sizeSheetStyles.title,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
        >
          {t('product.selectSize', 'Chọn size')}
        </Text>
      </View>

      {variants.length > 0 ? (
        <BottomSheetFlatList
          data={variants}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={selectedSlug}
          initialNumToRender={6}
          windowSize={3}
          maxToRenderPerBatch={6}
          removeClippedSubviews
          contentContainerStyle={sizeSheetStyles.listContent}
        />
      ) : (
        <View style={sizeSheetStyles.emptyContainer}>
          <Text
            style={[
              sizeSheetStyles.emptyText,
              { color: isDark ? colors.gray[400] : colors.gray[500] },
            ]}
          >
            {t('product.noVariants', 'Không có size khác')}
          </Text>
        </View>
      )}
    </BottomSheetModal>
  )
})

/** Individual size option row — memo'd to avoid re-render when siblings change */
const SizeOption = memo(function SizeOption({
  variant,
  isSelected,
  isDark,
  primaryColor,
  onSelect,
}: {
  variant: IProductVariant
  isSelected: boolean
  isDark: boolean
  primaryColor: string
  onSelect: (v: IProductVariant) => void
}) {
  const handlePress = useCallback(() => onSelect(variant), [onSelect, variant])
  const sizeName = variant.size?.name || ''

  return (
    <Pressable
      onPress={handlePress}
      style={[
        sizeSheetStyles.optionRow,
        {
          backgroundColor: isSelected
            ? isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.03)'
            : 'transparent',
          borderColor: isSelected
            ? primaryColor
            : isDark
              ? colors.gray[800]
              : colors.gray[200],
        },
      ]}
    >
      <View style={sizeSheetStyles.optionInfo}>
        <Text
          style={[
            sizeSheetStyles.optionName,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
        >
          {capitalizeFirst(sizeName || 'Mặc định')}
        </Text>
        <Text
          style={[
            sizeSheetStyles.optionPrice,
            { color: isDark ? colors.gray[400] : colors.gray[500] },
          ]}
        >
          {formatCurrencyNative(variant.price)}
        </Text>
      </View>
      <View
        style={[
          sizeSheetStyles.radio,
          {
            borderColor: isSelected
              ? primaryColor
              : isDark
                ? colors.gray[600]
                : colors.gray[300],
          },
        ]}
      >
        {isSelected && (
          <View
            style={[
              sizeSheetStyles.radioInner,
              { backgroundColor: primaryColor },
            ]}
          />
        )}
      </View>
    </Pressable>
  )
})

const sizeSheetStyles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionPrice: {
    fontSize: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 13,
  },
})
