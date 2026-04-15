/**
 * Perf Product Detail Footer — Primary-colored add-to-cart button.
 * Floating effect: very subtle shadow + thin top border, không blur.
 */
import { ShoppingBag } from 'lucide-react-native'
import React from 'react'
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import {
  useDetailComputedTotalPrice,
  useDetailPrice,
  useDetailSelectedVariant,
} from '@/stores/selectors'
import { formatCurrency } from '@/utils'

export interface ProductPriceFooterProps {
  totalPriceLabel: string
  chooseSizeLabel: string
  addToCartLabel: string
  outOfStockLabel: string
  isLocked: boolean
  onAddToCart: () => void
}

export const ProductPriceFooter = React.memo(function ProductPriceFooter({
  totalPriceLabel,
  chooseSizeLabel,
  addToCartLabel,
  outOfStockLabel,
  isLocked,
  onAddToCart,
}: ProductPriceFooterProps) {
  const insets = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const price = useDetailPrice()
  const computedTotalPrice = useDetailComputedTotalPrice()
  const selectedVariant = useDetailSelectedVariant()
  const isDisabled = isLocked || !selectedVariant

  const bgColor = isDark ? colors.gray[900] : colors.white.light

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: insets.bottom + 12, backgroundColor: bgColor },
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
      <View style={styles.row}>
        {/* Price column */}
        <View style={styles.priceCol}>
          <Text
            style={[
              styles.priceLabel,
              { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' },
            ]}
          >
            {totalPriceLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.priceValue,
              {
                fontSize: price != null ? 19 : 14,
                color:
                  price != null
                    ? primaryColor
                    : isDark
                      ? colors.gray[500]
                      : colors.gray[400],
              },
            ]}
          >
            {computedTotalPrice != null
              ? formatCurrency(computedTotalPrice)
              : chooseSizeLabel}
          </Text>
        </View>

        {/* Button */}
        <Pressable
          onPress={isDisabled ? undefined : onAddToCart}
          disabled={isDisabled}
          style={[
            styles.button,
            { backgroundColor: isDisabled ? colors.gray[300] : primaryColor },
          ]}
        >
          <ShoppingBag
            size={18}
            color={isDisabled ? colors.gray[400] : colors.white.light}
          />
          <Text
            style={[
              styles.buttonText,
              { color: isDisabled ? colors.gray[400] : colors.white.light },
            ]}
          >
            {isDisabled ? outOfStockLabel : addToCartLabel}
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
  priceCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceValue: {
    fontWeight: '700',
    marginTop: 1,
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
