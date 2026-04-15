import { MenuItemImage } from '@/components/menu/menu-item-image'
import { colors } from '@/constants'
import type { IMenuItem } from '@/types'
import { capitalizeFirst } from '@/utils'
import { formatCurrencyNative } from 'cart-price-calc'
import { Plus } from 'lucide-react-native'
import React, { createContext, memo, useCallback, useContext } from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'

/** Number of items allowed to show images (listIndex < value). 0 = none. */
export const MenuImagePhaseContext = createContext(0)

export type MenuDisplayItem = {
  id: string
  name: string
  rawPrice: number
  promotionValue: number
  imageUrl: string | null
  heroImagePaths: string[]
  listIndex: number
  /** Slug of the cheapest variant — used for cart + voucher API */
  defaultVariantSlug: string
  /** Raw menu item — used for constructing IOrderItem when adding to cart */
  menuItem: IMenuItem
  /** Pre-computed cheapest variant — avoids reduce() on every tap */
  cheapestVariant: import('@/types').IProductVariant | null
  /** Pre-computed hero image URLs — serialized lazily on navigation */
  heroImageUrls: string[]
}

export const MENU_IMAGE_HIGH_PRIORITY_COUNT = 4
export const MENU_ITEM_ESTIMATED_HEIGHT = 140

export const menuKeyExtractor = (item: MenuDisplayItem) => item.id
export const menuViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 80,
}
export const menuOverrideItemLayout = (layout: { span?: number; size?: number }) => {
  layout.size = MENU_ITEM_ESTIMATED_HEIGHT
}

export const MenuItemRow = memo(
  function MenuItemRow({
    id,
    name,
    imageUrl,
    listIndex,
    rawPrice,
    promotionValue,
    primaryColor,
    onDetail,
    onAddToCart,
  }: {
    id: string
    name: string
    imageUrl: string | null
    listIndex: number
    rawPrice: number
    promotionValue: number
    primaryColor: string
    onDetail: (id: string) => void
    onAddToCart: (id: string) => void
  }) {
    const isDark = useColorScheme() === 'dark'
    const phaseCount = useContext(MenuImagePhaseContext)
    const showImage = listIndex < phaseCount
    const imagePriority =
      showImage && listIndex < MENU_IMAGE_HIGH_PRIORITY_COUNT ? 'high' : 'normal'
    const hasPromotion = promotionValue > 0 && rawPrice > 0
    const discountedPrice = hasPromotion
      ? rawPrice * (1 - promotionValue / 100)
      : rawPrice

    const handlePress = useCallback(() => onDetail(id), [id, onDetail])
    const handleAdd = useCallback(() => onAddToCart(id), [id, onAddToCart])

    const cardBg = isDark ? colors.card.dark : colors.card.light
    const nameColor = isDark ? colors.gray[50] : colors.gray[900]
    const discountedColor = isDark ? colors.warning.dark : colors.warning.textLight
    const originalColor = isDark ? colors.gray[500] : colors.gray[400]
    const badgeBg = isDark ? colors.destructive.dark : colors.destructive.light

    return (
      <Pressable onPress={handlePress} style={styles.wrapper}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.imageWrap}>
            <View style={styles.imageInner}>
              <MenuItemImage
                id={id}
                imageUrl={imageUrl}
                isEnabled={showImage}
                transitionMs={0}
                priority={imagePriority}
                borderRadius={12}
              />
            </View>
          </View>
          <View style={styles.content}>
            <Text style={[styles.productName, { color: nameColor }]} numberOfLines={1}>
              {capitalizeFirst(name)}
            </Text>
            {hasPromotion ? (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceDiscounted, { color: discountedColor }]}>
                    {formatCurrencyNative(discountedPrice)}
                  </Text>
                  <View style={[styles.pricePromotionBadge, { backgroundColor: badgeBg }]}>
                    <Text style={styles.pricePromotionText}>
                      -{promotionValue}%
                    </Text>
                  </View>
                  <Text style={[styles.priceOriginal, { color: originalColor }]}>
                    {formatCurrencyNative(rawPrice)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.priceRegular, { color: primaryColor }]}>
                  {formatCurrencyNative(rawPrice)}
                </Text>
              )}
            <View style={styles.addButtonWrap}>
              <Pressable
                onPress={handleAdd}
                style={[styles.addButton, { backgroundColor: primaryColor }]}
              >
                <Plus size={20} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    )
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.name === next.name &&
    prev.imageUrl === next.imageUrl &&
    prev.listIndex === next.listIndex &&
    prev.rawPrice === next.rawPrice &&
    prev.promotionValue === next.promotionValue &&
    prev.primaryColor === next.primaryColor &&
    prev.onDetail === next.onDetail &&
    prev.onAddToCart === next.onAddToCart,
)

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
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
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  priceDiscounted: {
    fontSize: 14,
    fontWeight: '700',
  },
  pricePromotionBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pricePromotionText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white.light,
  },
  priceOriginal: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  priceRegular: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  addButtonWrap: {
    alignSelf: 'flex-end',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
