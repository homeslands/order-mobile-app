import { Image } from 'expo-image'
import type { TFunction } from 'i18next'
import { Plus } from 'lucide-react-native'
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'

import { Images } from '@/assets/images'
import { OrderFlowStep, ROUTE, publicFileURL } from '@/constants'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import {
  usePressInPrefetchMenuItem,
  usePublicSpecificMenu,
  useSpecificMenu,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { useOrderFlowStore, useBranchStore, useUserStore } from '@/stores'
import type { IMenuItem, IOrderItem } from '@/types'
import { formatCurrency, showToast } from '@/utils'

/** Ngày cố định trong session — thay useRef vì linter cấm đọc ref trong render */
const SESSION_DATE_STR = new Date().toISOString().split('T')[0]

interface SliderRelatedProductsProps {
  currentProduct: string
  catalog: string
}

const RelatedProductItem = React.memo(
  function RelatedProductItem({
    item,
    itemWidth,
    itemSpacing,
    onPress,
    onPressIn,
    onAddToCart,
    primaryColor,
    t,
  }: {
    item: import('@/types').IMenuItem
    itemWidth: number
    itemSpacing: number
    onPress: (slug: string) => void
    onPressIn: (slug: string) => void
    onAddToCart: (slug: string) => void
    primaryColor: string
    t: TFunction<'menu'>
  }) {
    const handleAdd = useCallback(
      () => onAddToCart(item.slug),
      [onAddToCart, item.slug],
    )
    const imageUrl = useMemo(() => {
      const imagePath = item?.product.image?.trim()
      if (!imagePath) return null
      if (/^https?:\/\//i.test(imagePath)) return imagePath
      const base = publicFileURL ?? ''
      if (!base) return null
      return `${base.replace(/\/$/, '')}/${imagePath.replace(/^\//, '')}`
    }, [item.product.image])
    const hasProductImage = imageUrl != null
    const priceRange = useMemo(() => {
      const variants = item.product.variants
      if (!variants?.length) return null
      const prices = variants.map((v) => v.price)
      return {
        min: Math.min(...prices),
        max: Math.max(...prices),
        isSinglePrice: Math.min(...prices) === Math.max(...prices),
      }
    }, [item.product.variants])
    const hasPromotion = item.promotion && item.promotion.value > 0

    return (
      <Pressable
        onPressIn={() => onPressIn(item.slug)}
        onPress={() => onPress(item.slug)}
        className="active:opacity-80"
        style={{ width: itemWidth, marginRight: itemSpacing }}
        {...({ unstable_pressDelay: 0 } as object)}
      >
        <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {/* Image — padded for breathing room */}
          <View className="p-2 pb-0">
            <View
              className="relative w-full overflow-hidden rounded-xl"
              style={{ aspectRatio: 4 / 3 }}
            >
              {hasProductImage ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  recyclingKey={item.slug}
                  placeholder={Images.Food.DefaultProductImage}
                  placeholderContentFit="cover"
                  cachePolicy="disk"
                  priority="low"
                />
              ) : (
                <Image
                  source={Images.Food.DefaultProductImage}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                />
              )}
              {hasPromotion && (
                <View className="absolute right-1.5 top-1.5 rounded-md bg-red-500 px-1.5 py-0.5">
                  <Text className="text-[10px] font-semibold text-white">
                    -{item.promotion?.value}%
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Content — below image */}
          <View className="gap-1 px-2.5 pb-2.5 pt-2">
            <Text
              className="text-[13px] font-bold capitalize text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {item.product.name}
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                {hasPromotion ? (
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs text-gray-400 line-through">
                      {priceRange
                        ? formatCurrency(priceRange.min)
                        : formatCurrency(0)}
                    </Text>
                    <Text className="text-[13px] font-semibold text-primary">
                      {priceRange
                        ? formatCurrency(
                            priceRange.min *
                              (1 - (item.promotion?.value || 0) / 100),
                          )
                        : formatCurrency(0)}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-[13px] font-semibold text-primary">
                    {priceRange
                      ? formatCurrency(priceRange.min)
                      : t('menu.contactForPrice', 'Liên hệ')}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={handleAdd}
                hitSlop={6}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: primaryColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={14} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    )
  },
  (prev, next) =>
    prev.item.slug === next.item.slug &&
    prev.primaryColor === next.primaryColor,
)

function SliderRelatedProducts({
  currentProduct,
  catalog,
}: SliderRelatedProductsProps) {
  const { t } = useTranslation('menu')
  const primaryColor = usePrimaryColor()
  const prefetchMenuItem = usePressInPrefetchMenuItem()
  const branchSlug = useBranchStore((s) => s.branch?.slug)
  const userSlug = useUserStore((s) => s.userInfo?.slug)
  // Ref for O(1) lookup — avoids closing over relatedProductsData in callbacks
  const itemsMapRef = useRef<Map<string, IMenuItem>>(new Map())

  const filters = useMemo(
    () => ({
      date: SESSION_DATE_STR,
      branch: branchSlug,
      catalog,
      productName: '',
      minPrice: 0,
      maxPrice: 1000000,
    }),
    [branchSlug, catalog],
  )

  const hasUser = !!userSlug
  const hasBranch = !!filters.branch

  const [fetchEnabled, setFetchEnabled] = useState(false)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => setFetchEnabled(true), 500)
    })
    return () => {
      task.cancel()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const { data: relatedProducts, isPending } = useSpecificMenu(
    filters,
    hasUser && hasBranch && fetchEnabled,
  )
  const { data: publicSpecificMenu, isPending: isPendingPublicSpecificMenu } =
    usePublicSpecificMenu(filters, !hasUser && hasBranch && fetchEnabled)

  const relatedProductsData = useMemo(() => {
    const items = hasUser
      ? relatedProducts?.result.menuItems
      : publicSpecificMenu?.result.menuItems
    return items?.filter((item) => item.slug !== currentProduct) ?? []
  }, [
    hasUser,
    relatedProducts?.result.menuItems,
    publicSpecificMenu?.result.menuItems,
    currentProduct,
  ])

  // Keep O(1) lookup map in sync
  useEffect(() => {
    const m = new Map<string, IMenuItem>()
    for (const item of relatedProductsData) m.set(item.slug, item)
    itemsMapRef.current = m
  }, [relatedProductsData])

  const isLoading = hasUser ? isPending : isPendingPublicSpecificMenu

  // 2 items visible, padding synced with body section (16px)
  const { itemWidth, itemSpacing } = useMemo(() => {
    const w = Dimensions.get('window').width
    const padding = 16
    const gap = 10
    const width = (w - padding * 2 - gap) / 2
    return { itemWidth: width, itemSpacing: gap }
  }, [])

  const handleItemPress = useCallback((slug: string) => {
    const mi = itemsMapRef.current.get(slug)
    if (!mi) {
      navigateNative.push({
        pathname: ROUTE.CLIENT_PRODUCT_DETAIL,
        params: { id: slug },
      })
      return
    }
    const variants = mi.product?.variants ?? []
    const minPrice =
      variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0
    const heroImages = [
      mi.product?.image,
      ...(mi.product?.images ?? []),
    ].filter((v): v is string => !!v)
    const heroImageUrls = heroImages
      .map((p) => {
        if (!p?.trim()) return null
        if (/^https?:\/\//i.test(p)) return p
        const base = publicFileURL ?? ''
        return base
          ? `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`
          : null
      })
      .filter((u): u is string => !!u)

    navigateNative.push({
      pathname: ROUTE.CLIENT_PRODUCT_DETAIL,
      params: {
        id: mi.slug,
        name: mi.product?.name ?? '',
        basePrice: String(minPrice),
        promotionValue: String(mi.promotion?.value ?? 0),
        imageUrl: heroImageUrls[0] ?? '',
        imageUrls: JSON.stringify(heroImageUrls),
      },
    })
  }, [])

  const handlePressIn = useCallback(
    (slug: string) => {
      prefetchMenuItem(slug)
    },
    [prefetchMenuItem],
  )

  const handleAdd = useCallback(
    (slug: string) => {
      const mi = itemsMapRef.current.get(slug)
      if (!mi) return
      const variants = mi.product?.variants ?? []
      if (variants.length === 0) return
      // Find cheapest variant
      let cheapest = variants[0]
      for (let i = 1; i < variants.length; i++) {
        if (variants[i].price < cheapest.price) cheapest = variants[i]
      }
      // Read store at call time — no subscription
      const store = useOrderFlowStore.getState()
      if (!store.isHydrated) return
      if (store.currentStep !== OrderFlowStep.ORDERING)
        store.setCurrentStep(OrderFlowStep.ORDERING)
      if (!store.orderingData) store.initializeOrdering()
      const uSlug = useUserStore.getState().userInfo?.slug
      if (uSlug && !store.orderingData?.owner?.trim())
        store.initializeOrdering()

      const orderItem: IOrderItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        slug: mi.product?.slug || '',
        image: mi.product?.image || '',
        name: mi.product?.name || '',
        quantity: 1,
        size: cheapest.size?.name || '',
        allVariants: variants,
        variant: cheapest,
        originalPrice: cheapest.price,
        productSlug: mi.product?.slug || '',
        description: mi.product?.description || '',
        isLimit: mi.product?.isLimit || false,
        isGift: mi.product?.isGift || false,
        promotion: mi.promotion ?? null,
        promotionValue: mi.promotion?.value ?? 0,
        note: '',
      }
      store.addOrderingItem(orderItem)
      showToast(t('menu.addedToCart', { name: mi.product?.name }))
    },
    [t],
  )

  if (!relatedProductsData || relatedProductsData.length === 0) {
    if (isLoading) {
      return (
        <View style={{ marginTop: 16 }}>
          <Text className="mb-3 text-base font-bold text-gray-900 dark:text-white">
            {t('menu.relatedProducts', 'Sản phẩm liên quan')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {[0, 1, 2, 3].map((i) => (
              <View
                key={`skel-${i}`}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                style={{ width: itemWidth, marginRight: itemSpacing }}
              >
                <View className="p-2 pb-0">
                  <View
                    className="rounded-xl bg-gray-200 dark:bg-gray-700"
                    style={{ aspectRatio: 4 / 3 }}
                  />
                </View>
                <View className="gap-2 px-2.5 pb-2.5 pt-2">
                  <View className="h-3.5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                  <View className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )
    }
    return null
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Text className="mb-3 text-base font-bold text-gray-900 dark:text-white">
        {t('menu.relatedProducts', 'Sản phẩm liên quan')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {relatedProductsData.map((item) => (
          <RelatedProductItem
            key={item.slug}
            item={item}
            itemWidth={itemWidth}
            itemSpacing={itemSpacing}
            onPress={handleItemPress}
            onPressIn={handlePressIn}
            onAddToCart={handleAdd}
            primaryColor={primaryColor}
            t={t}
          />
        ))}
      </ScrollView>
    </View>
  )
}

export default memo(SliderRelatedProducts)
