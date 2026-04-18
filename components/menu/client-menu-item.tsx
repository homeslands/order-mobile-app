import { Image } from 'expo-image'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Images } from '@/assets/images'
import { NativeGesturePressable } from '@/components/navigation'
import { publicFileURL, ROUTE } from '@/constants'
import { useIsMobile, usePressInPrefetchMenuItem } from '@/hooks'
import { IMenuItem, IProduct } from '@/types'
import { formatCurrency } from '@/utils'

import { MenuItemQuantityControl } from './menu-item-quantity-control'

interface IClientMenuItemProps {
  item: IMenuItem
  onAddToCart?: (item: IMenuItem) => void
}

function getMinPrice(variants: IProduct['variants']): number | null {
  if (!variants?.length) return null
  return Math.min(...variants.map((v) => v.price))
}

function clientMenuItemAreEqual(
  prev: Readonly<IClientMenuItemProps>,
  next: Readonly<IClientMenuItemProps>,
): boolean {
  if (prev.onAddToCart !== next.onAddToCart) return false
  const a = prev.item
  const b = next.item
  return (
    a.slug === b.slug &&
    a.product?.slug === b.product?.slug &&
    a.currentStock === b.currentStock &&
    a.defaultStock === b.defaultStock &&
    a.isLocked === b.isLocked &&
    a.promotion?.value === b.promotion?.value &&
    getMinPrice(a.product?.variants) === getMinPrice(b.product?.variants)
  )
}

/**
 * ClientMenuItem — Chỉ chứa hình ảnh, tên, giá (tĩnh).
 * Không subscribe store. MenuItemQuantityControl xử lý quantity + Add to cart.
 */
export const ClientMenuItem = React.memo(function ClientMenuItem({
  item,
  onAddToCart,
}: IClientMenuItemProps) {
  const { t } = useTranslation('menu')
  const prefetchMenuItem = usePressInPrefetchMenuItem()
  const isMobile = useIsMobile()

  const imageUrl = useMemo(() => {
    const path = item.product.image?.trim()
    if (!path) return null
    // Nếu backend trả về URL đầy đủ thì dùng trực tiếp
    if (/^https?:\/\//i.test(path)) return path
    const base = publicFileURL ?? ''
    if (!base) return null
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  }, [item.product.image])
  const priceRange = useMemo(() => {
    const variants = item.product.variants
    if (!variants?.length) return null
    const prices = variants.map((v) => v.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    return {
      min: minPrice,
      max: maxPrice,
      isSinglePrice: minPrice === maxPrice,
    }
  }, [item.product.variants])

  const currentStock = item.currentStock ?? 0
  const defaultStock = item.defaultStock ?? 0
  const hasStock = !item.isLocked && (currentStock > 0 || !item.product.isLimit)
  const hasPromotion = item.promotion && item.promotion.value > 0

  return (
    <View className="min-h-[2rem] flex-row justify-between overflow-hidden rounded-xl border border-gray-200 sm:flex-col dark:border-gray-700 dark:bg-gray-800">
      {/* Image */}
      <NativeGesturePressable
        navigation={{
          type: 'push',
          href: {
            pathname: ROUTE.CLIENT_PRODUCT_DETAIL,
            params: { id: item.slug },
          },
        }}
        onPressIn={() => {
          prefetchMenuItem(item.slug)
          if (item.product.image && imageUrl) {
            const urls = new Set<string>([imageUrl])
            item.product.images?.forEach((img) => {
              if (publicFileURL)
                urls.add(
                  `${publicFileURL.replace(/\/$/, '')}/${(img || '').replace(/^\//, '')}`,
                )
            })
            Image.prefetch([...urls]).catch(() => {})
          }
        }}
        className={`flex-shrink-0 items-center justify-center ${
          isMobile ? 'h-32 w-32 p-2' : 'aspect-square w-full p-0'
        }`}
      >
        <View
          className="relative h-full w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700"
          style={{ aspectRatio: 1 }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={item.slug}
              style={{ width: '100%', height: '100%', borderRadius: 12 }}
            />
          ) : (
            <Image
              source={Images.Food.DefaultProductImage}
              contentFit="cover"
              style={{ width: '100%', height: '100%', borderRadius: 12 }}
            />
          )}
          {item.product.isLimit && !isMobile && (
            <View className="absolute bottom-3 left-3 z-50 rounded-full bg-primary px-3 py-1">
              <Text className="text-xs text-white">
                {t('menu.amount', 'Số lượng')} {currentStock}/{defaultStock}
              </Text>
            </View>
          )}
          {hasPromotion && (
            <View className="absolute right-2 top-2 z-50 rounded-full bg-red-500 px-2 py-1">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-white">
                -{item.promotion.value}%
              </Text>
            </View>
          )}
        </View>
      </NativeGesturePressable>

      {/* Content */}
      <View className="flex-1 flex-col justify-between px-2 py-3">
        {isMobile ? (
          <View className="flex-col items-start gap-2">
            <Text
              className="flex-1 py-1 text-lg font-bold text-foreground"
              numberOfLines={1}
            >
              {item.product.name}
            </Text>
            {item.product.isLimit && (
              <View className="rounded-full bg-primary px-2 py-1">
                <Text className="whitespace-nowrap text-xs text-white">
                  {t('menu.amount', 'Số lượng')} {currentStock}/{defaultStock}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text
            className="py-1 text-base text-lg font-bold text-foreground"
            numberOfLines={1}
          >
            {item.product.name}
          </Text>
        )}

        {/* Mobile: Price and Button */}
        {isMobile ? (
          <View className="mt-2 flex-row items-center justify-between">
            {hasStock && (
              <View className="flex-1 py-1">
                {item.product.variants.length > 0 ? (
                  hasPromotion ? (
                    <>
                      <Text className="text-xs text-gray-500 line-through dark:text-gray-400">
                        {priceRange
                          ? formatCurrency(priceRange.min)
                          : formatCurrency(0)}
                      </Text>
                      <Text className="text-sm font-bold text-primary">
                        {priceRange
                          ? formatCurrency(
                              priceRange.min *
                                (1 - (item.promotion?.value || 0) / 100),
                            )
                          : formatCurrency(0)}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-sm font-bold text-primary">
                      {priceRange
                        ? formatCurrency(priceRange.min)
                        : formatCurrency(0)}
                    </Text>
                  )
                ) : (
                  <Text className="text-sm font-bold text-primary">
                    {t('menu.contactForPrice', 'Liên hệ')}
                  </Text>
                )}
              </View>
            )}
            <MenuItemQuantityControl
              item={item}
              hasStock={hasStock}
              isMobile={true}
              onAddToCart={onAddToCart}
            />
          </View>
        ) : item.product.variants.length > 0 ? (
          <View className="gap-1 py-1">
            {hasPromotion ? (
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-gray-500 line-through sm:text-sm dark:text-gray-400">
                  {priceRange
                    ? formatCurrency(priceRange.min)
                    : formatCurrency(0)}
                </Text>
                <Text className="text-sm font-bold text-primary sm:text-lg">
                  {priceRange
                    ? formatCurrency(
                        priceRange.min *
                          (1 - (item.promotion?.value || 0) / 100),
                      )
                    : formatCurrency(0)}
                </Text>
              </View>
            ) : (
              <Text className="text-sm font-bold text-primary sm:text-lg">
                {priceRange
                  ? formatCurrency(priceRange.min)
                  : formatCurrency(0)}
              </Text>
            )}
          </View>
        ) : (
          <Text className="py-1 text-sm font-bold text-primary">
            {t('menu.contactForPrice', 'Liên hệ')}
          </Text>
        )}
      </View>

      {/* Desktop: Add to Cart / Quantity */}
      {!isMobile && (
        <View className="flex items-end justify-end p-2 sm:w-full">
          <MenuItemQuantityControl
            item={item}
            hasStock={hasStock}
            isMobile={false}
            onAddToCart={onAddToCart}
          />
        </View>
      )}
    </View>
  )
}, clientMenuItemAreEqual)
