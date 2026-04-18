/**
 * Product Detail Options — Progressive rendering + View flattening.
 *
 * Data Layering:
 * 1. Product info (name, price, promotion) render ngay.
 * 2. Options (variants, quantity, toppings) defer bằng requestAnimationFrame
 *    để giảm spike mount khi có 20-30 topping.
 *
 * View flattening:
 * - Dùng flexWrap trực tiếp, ít View lồng nhau.
 * - VariantChip: View duy nhất thay vì View > View > Text.
 */
import NonPropQuantitySelector from '@/components/button/non-prop-quantity-selector'
import { StaticText } from '@/components/ui'
import { colors } from '@/constants'
import type { IProductVariant } from '@/types'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { HIT_SLOP_ICON } from '@/lib/navigation'
import {
  useDetailQuantity,
  useDetailSetQuantity,
  useDetailSetSelection,
  useDetailSize,
} from '@/stores/selectors'

const styles = StyleSheet.create({
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  variantChipSelectedLight: {
    borderColor: colors.primary.light,
    backgroundColor: colors.primary.light,
  },
  variantChipSelectedDark: {
    borderColor: colors.primary.dark,
    backgroundColor: colors.primary.dark,
  },
  variantChipUnselectedLight: {
    borderColor: colors.gray[400],
    backgroundColor: 'transparent',
  },
  variantChipUnselectedDark: {
    borderColor: colors.gray[500],
    backgroundColor: 'transparent',
  },
  variantChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  variantChipTextSelected: { color: colors.white.light },
  variantChipTextUnselectedLight: { color: colors.gray[700] },
  variantChipTextUnselectedDark: { color: colors.gray[300] },
})

/** Chip đơn — subscribe atomic useDetailSize → chỉ re-render khi size thay đổi */
const VariantChip = React.memo(function VariantChip({
  variant,
  onSelect,
}: {
  variant: IProductVariant
  onSelect: (v: IProductVariant) => void
}) {
  const isDark = useColorScheme() === 'dark'
  const selectedSize = useDetailSize()
  const isSelected = selectedSize === variant.size.name

  const handlePress = useCallback(() => onSelect(variant), [variant, onSelect])

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={HIT_SLOP_ICON}
      style={[
        styles.variantChip,
        isSelected
          ? isDark
            ? styles.variantChipSelectedDark
            : styles.variantChipSelectedLight
          : isDark
            ? styles.variantChipUnselectedDark
            : styles.variantChipUnselectedLight,
      ]}
      {...({ unstable_pressDelay: 0 } as object)}
    >
      <Text
        style={[
          styles.variantChipText,
          isSelected
            ? styles.variantChipTextSelected
            : isDark
              ? styles.variantChipTextUnselectedDark
              : styles.variantChipTextUnselectedLight,
        ]}
      >
        {variant.size.name.toUpperCase()}
      </Text>
    </Pressable>
  )
})

export interface ProductDetailOptionsSectionProps {
  productSlug: string
  variants: IProductVariant[]
  description: string
  isLimit: boolean
  isLocked: boolean
  currentStock: number
  defaultStock: number
  inStockLabel: string
  selectSizeLabel: string
  selectQuantityLabel: string
  descriptionLabel: string
  noDescriptionLabel: string
  promotionDescription?: string
  promotionSpecialLabel?: string
}

export const ProductDetailOptionsSection = React.memo(
  function ProductDetailOptionsSection({
    productSlug,
    variants,
    description,
    isLimit,
    isLocked,
    currentStock,
    defaultStock,
    inStockLabel,
    selectSizeLabel,
    selectQuantityLabel,
    descriptionLabel,
    noDescriptionLabel,
    promotionDescription,
    promotionSpecialLabel,
  }: ProductDetailOptionsSectionProps) {
    const isDark = useColorScheme() === 'dark'
    const setSelection = useDetailSetSelection()
    const quantity = useDetailQuantity()
    const setQuantity = useDetailSetQuantity()

    const handleSizeChange = useCallback(
      (variant: IProductVariant) => {
        setSelection({
          variant,
          size: variant.size.name,
          price: variant.price,
        })
      },
      [setSelection],
    )

    const initialVariant = useMemo(() => {
      if (variants?.length > 0) {
        return variants.reduce((prev, curr) =>
          prev.price < curr.price ? prev : curr,
        )
      }
      return null
    }, [variants])

    // Auto-select cheapest variant when product or variants change
    const lastAutoSelectedRef = useRef<string | null>(null)
    useEffect(() => {
      if (!initialVariant) return
      const key = `${productSlug}:${initialVariant.slug}`
      if (lastAutoSelectedRef.current === key) return
      lastAutoSelectedRef.current = key
      setSelection({
        variant: initialVariant,
        size: initialVariant.size.name,
        price: initialVariant.price,
        quantity: 1,
      })
    }, [productSlug, initialVariant, setSelection])

    return (
      <View style={{ flexDirection: 'column', gap: 16 }}>
        {variants.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: isDark ? colors.gray[50] : colors.gray[900],
              }}
            >
              {selectSizeLabel}
            </Text>
            <View style={styles.variantRow}>
              {variants.map((v) => (
                <VariantChip
                  key={v.slug}
                  variant={v}
                  onSelect={handleSizeChange}
                />
              ))}
            </View>
          </View>
        )}

        {variants.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              paddingTop: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: isDark ? colors.gray[50] : colors.gray[900],
              }}
            >
              {selectQuantityLabel}
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <NonPropQuantitySelector
                quantity={quantity}
                onChange={setQuantity}
                isLimit={isLimit}
                disabled={isLocked}
                currentQuantity={currentStock}
              />
              {isLimit && (
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.gray[400] : colors.gray[500],
                  }}
                >
                  {currentStock}/{defaultStock} {inStockLabel}
                </Text>
              )}
            </View>
          </View>
        )}

        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? colors.gray[700] : colors.gray[200],
            marginTop: 4,
          }}
        />
        <View style={{ gap: 4, paddingTop: 4 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: isDark ? colors.gray[50] : colors.gray[900],
            }}
          >
            {descriptionLabel}
          </Text>
          <StaticText
            contentKey={description || 'empty'}
            className="text-base leading-relaxed text-gray-700 dark:text-gray-300"
          >
            {description?.trim() || noDescriptionLabel}
          </StaticText>
        </View>

        {promotionDescription && promotionSpecialLabel && (
          <View
            style={{
              marginTop: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(234, 179, 8, 0.7)',
              backgroundColor: 'rgba(254, 249, 195, 0.5)',
              paddingHorizontal: 12,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: '#a16207',
                marginBottom: 4,
              }}
            >
              {promotionSpecialLabel}
            </Text>
            <Text style={{ fontSize: 14, color: colors.gray[800] }}>
              {promotionDescription}
            </Text>
          </View>
        )}
      </View>
    )
  },
)

/** Defer render children sau 1 frame — giảm mount spike khi có nhiều options */
export function DeferredOptionsSection({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!ready) {
    return (
      fallback ?? (
        <View
          style={{
            minHeight: 120,
            backgroundColor: colors.gray[200],
            borderRadius: 12,
            marginHorizontal: 16,
          }}
        />
      )
    )
  }

  return <>{children}</>
}
