import { formatCurrencyNative } from 'cart-price-calc'
import React from 'react'
import { StyleSheet, Text, View, useColorScheme } from 'react-native'

import { colors } from '@/constants'
import { usePrimaryColor } from '@/hooks/use-primary-color'

type ProductInfoCardProps = {
  name: string
  basePrice: number
  promotionValue: number
}

export function ProductInfoCard({
  name,
  basePrice,
  promotionValue,
}: ProductInfoCardProps) {
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const hasPromotion = promotionValue > 0
  const finalPrice = hasPromotion
    ? Math.max(0, Math.round(basePrice * (1 - promotionValue / 100)))
    : basePrice

  return (
    <View style={styles.card}>
      {/* Name + badge */}
      <Text
        style={[styles.name, { color: isDark ? colors.gray[50] : colors.gray[900] }]}
        numberOfLines={2}
      >
        {name.charAt(0).toUpperCase() + name.slice(1)}
      </Text>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={[styles.finalPrice, { color: primaryColor }]}>
          {formatCurrencyNative(finalPrice)}
        </Text>
        {hasPromotion && (
          <>
            <Text
              style={[
                styles.originalPrice,
                { color: isDark ? colors.gray[500] : colors.gray[400] },
              ]}
            >
              {formatCurrencyNative(basePrice)}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>-{promotionValue}%</Text>
            </View>
          </>
        )}
      </View>

      {/* Separator */}
      <View
        style={[
          styles.separator,
          { backgroundColor: isDark ? colors.gray[700] : colors.gray[200] },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finalPrice: {
    fontSize: 20,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  badge: {
    borderRadius: 6,
    backgroundColor: colors.destructive.light,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white.light,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
})
