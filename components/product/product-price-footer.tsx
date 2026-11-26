/**
 * Footer trang chi tiết món: bộ tăng giảm số lượng + nút "Thêm vào giỏ · tổng".
 * Floating effect: very subtle shadow + thin top border, không blur.
 */
import { RotateCw, ShoppingBag } from 'lucide-react-native'
import React from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import NonPropQuantitySelector from '@/components/button/non-prop-quantity-selector'
import { colors } from '@/constants'
import { FOOTER_BOTTOM_EXTRA } from '@/constants/status-bar'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import {
  useDetailComputedTotalPrice,
  useDetailQuantity,
  useDetailSelectedVariant,
  useDetailSetQuantity,
} from '@/stores/selectors'
import { formatCurrency } from '@/utils'
import { getProductAddButtonState } from '@/utils/menu-stock'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Text } from '@/components/ui/text'

/**
 * Chiều cao footer KHÔNG kể safe-area bottom: paddingTop (12) + hàng nút (48)
 * + FOOTER_BOTTOM_EXTRA. Màn detail dùng để chừa paddingBottom cho scroll:
 * `paddingBottom: insets.bottom + PRODUCT_FOOTER_BASE_HEIGHT + khoảng thở`.
 * Sửa style wrapper/nút thì nhớ cập nhật hằng số này.
 */
export const PRODUCT_FOOTER_BASE_HEIGHT = 12 + 48 + FOOTER_BOTTOM_EXTRA

export interface ProductPriceFooterProps {
  addToCartLabel: string
  outOfStockLabel: string
  retryLabel: string
  /** Đã có dữ liệu món từ API */
  isLoaded: boolean
  isError: boolean
  hasStock: boolean
  isLimit: boolean
  isLocked: boolean
  currentStock: number
  onAddToCart: () => void
  onRetry: () => void
}

export const ProductPriceFooter = React.memo(function ProductPriceFooter({
  addToCartLabel,
  outOfStockLabel,
  retryLabel,
  isLoaded,
  isError,
  hasStock,
  isLimit,
  isLocked,
  currentStock,
  onAddToCart,
  onRetry,
}: ProductPriceFooterProps) {
  const insets = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const quantity = useDetailQuantity()
  const setQuantity = useDetailSetQuantity()
  const computedTotalPrice = useDetailComputedTotalPrice()
  const selectedVariant = useDetailSelectedVariant()
  const buttonState = getProductAddButtonState({
    hasData: isLoaded,
    isError,
    hasStock,
    hasSelectedVariant: !!selectedVariant,
  })
  const isRetry = buttonState === 'error'
  const isDisabled = buttonState === 'loading' || buttonState === 'outOfStock'
  const ButtonIcon = isRetry ? RotateCw : ShoppingBag
  const buttonLabel = isRetry
    ? retryLabel
    : buttonState === 'outOfStock'
      ? outOfStockLabel
      : computedTotalPrice != null
        ? `${addToCartLabel} · ${formatCurrency(computedTotalPrice)}`
        : addToCartLabel

  const bgColor = isDark ? colors.card.dark : colors.white.light

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: insets.bottom + FOOTER_BOTTOM_EXTRA },
        isDark ? styles.borderDark : styles.borderLight,
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
          },
          android: { elevation: 4 },
        }),
      ]}
    >
      <GlassSurface color={bgColor} style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        <NonPropQuantitySelector
          quantity={quantity}
          onChange={setQuantity}
          isLimit={isLimit}
          disabled={isLocked || !hasStock}
          currentQuantity={currentStock}
        />

        {/* Button */}
        <Pressable
          onPress={isDisabled ? undefined : isRetry ? onRetry : onAddToCart}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isDisabled,
            busy: buttonState === 'loading',
          }}
          style={[
            styles.button,
            { backgroundColor: isDisabled ? colors.gray[300] : primaryColor },
          ]}
        >
          <ButtonIcon
            size={18}
            color={isDisabled ? colors.gray[400] : colors.white.light}
          />
          <Text
            style={[
              styles.buttonText,
              { color: isDisabled ? colors.gray[400] : colors.white.light },
            ]}
          >
            {buttonLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  borderLight: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  borderDark: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 9999,
    height: 48,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
