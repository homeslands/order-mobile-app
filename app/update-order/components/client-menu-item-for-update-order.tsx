import { formatCurrencyNative } from 'cart-price-calc'
import dayjs from 'dayjs'
import { Plus } from 'lucide-react-native'
import React, { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { MenuItemImage } from '@/components/menu/menu-item-image'
import { colors, publicFileURL } from '@/constants'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { useOrderFlowStore } from '@/stores'
import { IMenuItem, IOrderItem } from '@/types'
import { capitalizeFirst, showToast } from '@/utils'

interface ClientMenuItemForUpdateOrderProps {
  item: IMenuItem
  listIndex: number
  showImage?: boolean
  primaryColor: string
}

/**
 * Menu item cho Update Order — clone 100% MenuItemRow từ menu screen.
 * useShallow: chỉ re-render khi hasUpdatingData thay đổi (null → data).
 */
const ClientMenuItemForUpdateOrder = memo(
  function ClientMenuItemForUpdateOrder({
    item,
    listIndex,
    showImage = true,
    primaryColor,
  }: ClientMenuItemForUpdateOrderProps) {
    const { t: tToast } = useTranslation('toast')
    const { addDraftItem, hasUpdatingData } = useOrderFlowStore(
      useShallow((s) => ({
        addDraftItem: s.addDraftItem,
        hasUpdatingData: s.updatingData !== null,
      })),
    )

    const imageUrl = item.product.image
      ? `${publicFileURL}/${item.product.image}`
      : null

    const hasPromotion = (item.promotion?.value ?? 0) > 0
    const promotionValue = item.promotion?.value ?? 0
    const cheapestVariant = useMemo(() => {
      const variants = item.product.variants
      if (!variants?.length) return null
      return variants.reduce(
        (min, v) => (v.price < min.price ? v : min),
        variants[0],
      )
    }, [item.product.variants])
    const rawPrice = cheapestVariant?.price ?? 0
    const discountedPrice = hasPromotion
      ? rawPrice * (1 - promotionValue / 100)
      : rawPrice

    const imagePriority =
      showImage && listIndex < 4 ? ('high' as const) : ('normal' as const)

    const handleAdd = () => {
      if (!hasUpdatingData || !item?.product?.variants?.length) return

      const variant = cheapestVariant ?? item.product.variants[0]
      const orderItem: IOrderItem = {
        id: `item_${dayjs().valueOf()}_${Math.random().toString(36).substr(2, 9)}`,
        slug: item.product.slug,
        image: item.product.image,
        name: item.product.name,
        quantity: 1,
        size: variant?.size?.name,
        allVariants: item.product.variants,
        variant,
        originalPrice: variant?.price,
        productSlug: item.product.slug,
        description: item.product.description,
        isLimit: item.product.isLimit,
        isGift: item.product.isGift,
        promotion: item.promotion ?? null,
        promotionValue: item.promotion?.value ?? 0,
        note: '',
      }

      try {
        scheduleStoreUpdate(() => addDraftItem(orderItem))
        showToast(tToast('toast.addSuccess'))
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ Error adding item to draft:', error)
      }
    }

    return (
      <Pressable style={mi.wrapper}>
        <View style={mi.card}>
          <View style={mi.imageWrap}>
            <MenuItemImage
              id={item.product.slug}
              imageUrl={imageUrl}
              isEnabled={showImage}
              transitionMs={0}
              priority={imagePriority}
            />
          </View>
          <View style={mi.content}>
            <View>
              <Text style={mi.productName} numberOfLines={1}>
                {capitalizeFirst(item.product.name)}
              </Text>
              {hasPromotion ? (
                <View style={mi.priceRow}>
                  <Text style={mi.priceDiscounted}>
                    {formatCurrencyNative(discountedPrice)}
                  </Text>
                  <View style={mi.pricePromotionBadge}>
                    <Text style={mi.pricePromotionText}>
                      -{promotionValue}%
                    </Text>
                  </View>
                  <Text style={mi.priceOriginal}>
                    {formatCurrencyNative(rawPrice)}
                  </Text>
                </View>
              ) : (
                <Text style={[mi.priceRegular, { color: primaryColor }]}>
                  {formatCurrencyNative(rawPrice)}
                </Text>
              )}
            </View>
            <View style={mi.addButtonWrap}>
              <Pressable
                onPress={handleAdd}
                style={[mi.addButton, { backgroundColor: primaryColor }]}
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
    prev.item === next.item &&
    prev.listIndex === next.listIndex &&
    prev.showImage === next.showImage &&
    prev.primaryColor === next.primaryColor,
)

export default ClientMenuItemForUpdateOrder

const mi = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: colors.white.light,
    borderRadius: 16,
    alignItems: 'stretch',
  },
  imageWrap: {
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[900],
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
    color: colors.warning.dark,
  },
  pricePromotionBadge: {
    backgroundColor: colors.destructive.dark,
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
    color: colors.gray[400],
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
