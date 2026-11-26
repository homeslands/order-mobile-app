import { formatCurrencyNative } from 'cart-price-calc'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'

import { colors } from '@/constants'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { hexToRgba } from '@/lib/utils'
import { Text } from '@/components/ui/text'

type ProductInfoCardProps = {
  name: string
  basePrice: number
  promotionValue: number
  /** Mô tả món; trống thì không hiện gì. */
  description: string
  isTopSell?: boolean
  isNew?: boolean
  topSellLabel: string
  newLabel: string
}

export function ProductInfoCard({
  name,
  basePrice,
  promotionValue,
  description,
  isTopSell = false,
  isNew = false,
  topSellLabel,
  newLabel,
}: ProductInfoCardProps) {
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const hasPromotion = promotionValue > 0
  const finalPrice = hasPromotion
    ? Math.max(0, Math.round(basePrice * (1 - promotionValue / 100)))
    : basePrice
  const desc = description.trim()
  // Mô tả dài: gập 3 dòng, chạm để mở hết.
  const [expanded, setExpanded] = useState(false)
  const toggleExpanded = useCallback(() => setExpanded((e) => !e), [])
  const tagBg = hexToRgba(primaryColor, isDark ? 0.18 : 0.14)

  return (
    <View style={styles.card}>
      {(isTopSell || isNew) && (
        <View style={styles.tagRow}>
          {isTopSell && (
            <View style={[styles.tag, { backgroundColor: tagBg }]}>
              <Text style={[styles.tagText, { color: primaryColor }]}>
                {topSellLabel}
              </Text>
            </View>
          )}
          {isNew && (
            <View style={[styles.tag, { backgroundColor: tagBg }]}>
              <Text style={[styles.tagText, { color: primaryColor }]}>
                {newLabel}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Name */}
      <Text
        style={[
          styles.name,
          { color: isDark ? colors.gray[50] : colors.gray[900] },
        ]}
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

      {desc ? (
        <Pressable onPress={toggleExpanded} accessibilityRole="text">
          <Text
            numberOfLines={expanded ? undefined : 3}
            style={[
              styles.description,
              { color: isDark ? colors.gray[300] : colors.gray[600] },
            ]}
          >
            {desc}
          </Text>
        </Pressable>
      ) : null}

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
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
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
