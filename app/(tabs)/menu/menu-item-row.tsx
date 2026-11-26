import { MenuItemImage } from '@/components/menu/menu-item-image'
import { colors } from '@/constants'
import { hexToRgba } from '@/lib/utils'
import type { IMenuItem } from '@/types'
import { capitalizeFirst } from '@/utils'
import { formatCurrencyNative } from 'cart-price-calc'
import { Plus } from 'lucide-react-native'
import React, { createContext, memo, useCallback, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'

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
  /** Còn đặt được (không khoá, còn số lượng hoặc không giới hạn) */
  hasStock: boolean
  /** Mô tả ngắn (đã trim), rỗng thì không hiện */
  description: string
  isTopSell: boolean
  isNew: boolean
}

export const MENU_IMAGE_HIGH_PRIORITY_COUNT = 4
/** Dòng món gọn: ảnh 76 + đệm dọc 12×2. */
export const MENU_ITEM_ESTIMATED_HEIGHT = 100
const IMAGE_SIZE = 76
/** Lề trái của chữ trong dòng — đường ngăn cách thụt tới đây (kiểu iOS). */
export const MENU_ROW_TEXT_INSET = 16 + IMAGE_SIZE + 12

export const menuKeyExtractor = (item: MenuDisplayItem) => item.id
export const menuViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 80,
}
export const menuOverrideItemLayout = (layout: {
  span?: number
  size?: number
}) => {
  layout.size = MENU_ITEM_ESTIMATED_HEIGHT
}

export const MenuItemRow = memo(
  function MenuItemRow({
    id,
    name,
    description,
    isTopSell,
    isNew,
    imageUrl,
    listIndex,
    rawPrice,
    promotionValue,
    primaryColor,
    isDark,
    hasStock,
    onDetail,
    onAddToCart,
  }: {
    id: string
    name: string
    description: string
    isTopSell: boolean
    isNew: boolean
    imageUrl: string | null
    listIndex: number
    rawPrice: number
    promotionValue: number
    primaryColor: string
    isDark: boolean
    hasStock: boolean
    onDetail: (id: string) => void
    onAddToCart: (id: string) => void
  }) {
    const { t } = useTranslation('menu')
    const phaseCount = useContext(MenuImagePhaseContext)
    const showImage = listIndex < phaseCount
    const imagePriority =
      showImage && listIndex < MENU_IMAGE_HIGH_PRIORITY_COUNT
        ? 'high'
        : 'normal'
    const hasPromotion = promotionValue > 0 && rawPrice > 0
    const discountedPrice = hasPromotion
      ? rawPrice * (1 - promotionValue / 100)
      : rawPrice

    const handlePress = useCallback(() => onDetail(id), [id, onDetail])
    const handleAdd = useCallback(() => onAddToCart(id), [id, onAddToCart])

    const rowBg = isDark ? colors.card.dark : colors.card.light
    const nameColor = isDark ? colors.gray[50] : colors.gray[900]
    const descColor = isDark ? colors.gray[400] : colors.gray[500]
    const discountedColor = isDark
      ? colors.warning.dark
      : colors.warning.textLight
    const originalColor = isDark ? colors.gray[500] : colors.gray[400]
    const badgeBg = isDark ? colors.destructive.dark : colors.destructive.light
    const tagBg = hexToRgba(primaryColor, isDark ? 0.18 : 0.14)
    const addButtonBg = hasStock
      ? primaryColor
      : isDark
        ? colors.gray[700]
        : colors.gray[300]
    const addIconColor = hasStock
      ? colors.white.light
      : isDark
        ? colors.gray[500]
        : colors.gray[400]
    const soldOutBg = isDark ? colors.gray[800] : colors.gray[900]
    const desc = description.trim()

    return (
      <Pressable
        onPress={handlePress}
        style={[styles.row, { backgroundColor: rowBg }]}
      >
        <View style={styles.imageWrap}>
          <View style={[styles.imageInner, !hasStock && styles.imageSoldOut]}>
            <MenuItemImage
              id={id}
              imageUrl={imageUrl}
              isEnabled={showImage}
              transitionMs={0}
              priority={imagePriority}
              borderRadius={12}
            />
          </View>
          {!hasStock && (
            <View style={styles.soldOutWrap} pointerEvents="none">
              <View
                style={[styles.soldOutBadge, { backgroundColor: soldOutBg }]}
              >
                <Text style={styles.soldOutText}>{t('menu.outOfStock')}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {(isTopSell || isNew) && (
            <View style={styles.tagRow}>
              {isTopSell && (
                <View style={[styles.tag, { backgroundColor: tagBg }]}>
                  <Text style={[styles.tagText, { color: primaryColor }]}>
                    {t('menu.isTopSell')}
                  </Text>
                </View>
              )}
              {isNew && (
                <View style={[styles.tag, { backgroundColor: tagBg }]}>
                  <Text style={[styles.tagText, { color: primaryColor }]}>
                    {t('menu.isNewProduct')}
                  </Text>
                </View>
              )}
            </View>
          )}
          <Text
            style={[styles.productName, { color: nameColor }]}
            numberOfLines={1}
          >
            {capitalizeFirst(name)}
          </Text>
          {desc ? (
            <Text
              testID="menu-row-description"
              style={[styles.description, { color: descColor }]}
              numberOfLines={1}
            >
              {desc}
            </Text>
          ) : null}
          {hasPromotion ? (
            <View style={styles.priceRow}>
              <Text
                style={[styles.priceDiscounted, { color: discountedColor }]}
              >
                {formatCurrencyNative(discountedPrice)}
              </Text>
              <View
                style={[
                  styles.pricePromotionBadge,
                  { backgroundColor: badgeBg },
                ]}
              >
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
        </View>

        <Pressable
          onPress={handleAdd}
          disabled={!hasStock}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('menu.addToCartA11y', { name })}
          accessibilityState={{ disabled: !hasStock }}
          style={[styles.addButton, { backgroundColor: addButtonBg }]}
        >
          <Plus size={18} color={addIconColor} />
        </Pressable>
      </Pressable>
    )
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.name === next.name &&
    prev.description === next.description &&
    prev.isTopSell === next.isTopSell &&
    prev.isNew === next.isNew &&
    prev.imageUrl === next.imageUrl &&
    prev.listIndex === next.listIndex &&
    prev.rawPrice === next.rawPrice &&
    prev.promotionValue === next.promotionValue &&
    prev.primaryColor === next.primaryColor &&
    prev.isDark === next.isDark &&
    prev.hasStock === next.hasStock &&
    prev.onDetail === next.onDetail &&
    prev.onAddToCart === next.onAddToCart,
)

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  imageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    flexShrink: 0,
  },
  imageInner: {
    flex: 1,
  },
  imageSoldOut: {
    opacity: 0.4,
  },
  soldOutWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soldOutText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white.light,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  tag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
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
    marginTop: 2,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
