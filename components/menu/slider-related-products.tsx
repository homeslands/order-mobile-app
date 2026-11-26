import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import type { TFunction } from 'i18next'
import { ChevronRight, Plus } from 'lucide-react-native'
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
  View,
} from 'react-native'

import { extractMenuItems } from '@/api/menu'
import { OrderFlowStep, ROUTE, colors } from '@/constants'
import { TAB_ROUTES } from '@/constants/navigation.config'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import {
  usePressInPrefetchMenuItem,
  usePublicSpecificMenu,
  useSpecificMenu,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { hexToRgba } from '@/lib/utils'
import { useOrderFlowStore, useBranchStore, useUserStore } from '@/stores'
import { useLoginSheetStore } from '@/stores/login-sheet.store'
import { useSetMenuFilter } from '@/stores/selectors'
import { useTransientNavStore } from '@/stores/transient-nav.store'
import type { IMenuItem, IOrderItem } from '@/types'
import { formatCurrency, showToast } from '@/utils'
import { getLocalDateString } from '@/utils/date'
import { hasMenuItemStock } from '@/utils/menu-stock'
import { getProductImageUrl, IMAGE_PRESET } from '@/utils/product-image-url'
import { Text } from '@/components/ui/text'

/** Ngày cố định trong session — thay useRef vì linter cấm đọc ref trong render */
const SESSION_DATE_STR = getLocalDateString()

/**
 * Số thẻ related hiển thị. Row là ScrollView ngang KHÔNG virtualize → mỗi thẻ
 * mount + decode ảnh ngay; giữ ít để tránh drop frame. Nếu catalog còn nhiều
 * hơn, hiện thẻ "Xem thêm" điều hướng sang tab Menu với catalog đã chọn.
 */
const VISIBLE_RELATED = 6

/**
 * Fetch dư 2 so với số hiển thị: đủ để (a) biết còn nhiều hơn không (hiện nút
 * "Xem thêm") kể cả khi sản phẩm hiện tại nằm trong trang, mà vẫn nhẹ tải —
 * chỉ lấy ~8 thẻ thay vì cả catalog.
 */
const RELATED_FETCH_SIZE = VISIBLE_RELATED + 2

interface SliderRelatedProductsProps {
  currentProduct: string
  catalog: string
}

/** Thẻ related: ảnh vuông + nút thêm trên ảnh, tên, giá. */
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
    item: IMenuItem
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
    const handlePress = useCallback(
      () => onPress(item.slug),
      [onPress, item.slug],
    )
    const handlePressIn = useCallback(
      () => onPressIn(item.slug),
      [onPressIn, item.slug],
    )
    const imageUrl = useMemo(
      () =>
        getProductImageUrl(item.product.image, {
          maxWidth: IMAGE_PRESET.THUMB,
        }),
      [item.product.image],
    )
    const minPrice = useMemo(() => {
      const variants = item.product.variants
      if (!variants?.length) return null
      return Math.min(...variants.map((v) => v.price))
    }, [item.product.variants])
    const promo = item.promotion?.value ?? 0
    const hasStock = hasMenuItemStock({
      isLocked: item.isLocked,
      currentStock: item.currentStock,
      isLimit: item.product.isLimit,
    })
    const canAdd = hasStock && minPrice != null
    const initial = item.product.name.trim().charAt(0).toUpperCase()

    return (
      <Pressable
        onPressIn={handlePressIn}
        onPress={handlePress}
        className="active:opacity-80"
        style={{ width: itemWidth, marginRight: itemSpacing }}
        {...({ unstable_pressDelay: 0 } as object)}
      >
        <View
          className="overflow-hidden rounded-2xl"
          style={{
            width: itemWidth,
            height: itemWidth,
            backgroundColor: hexToRgba(primaryColor, 0.12),
            opacity: hasStock ? 1 : 0.5,
          }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              recyclingKey={item.slug}
              cachePolicy="disk"
              priority="low"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text
                className="text-3xl font-bold"
                style={{ color: primaryColor }}
              >
                {initial}
              </Text>
            </View>
          )}
          {promo > 0 && (
            <View className="absolute left-2 top-2 rounded-md bg-red-500 px-1.5 py-0.5">
              <Text className="text-[10px] font-semibold text-white">
                -{promo}%
              </Text>
            </View>
          )}
        </View>

        {canAdd && (
          <Pressable
            onPress={handleAdd}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('menu.addToCart')}
            className="absolute items-center justify-center rounded-full border-2 border-white dark:border-black"
            style={{
              top: itemWidth - 40,
              right: 8,
              width: 32,
              height: 32,
              backgroundColor: primaryColor,
            }}
          >
            <Plus size={16} color={colors.white.light} />
          </Pressable>
        )}

        <View className="gap-0.5 pt-2">
          <Text
            className="text-[13px] font-semibold capitalize leading-[18px] text-gray-900 dark:text-white"
            numberOfLines={2}
          >
            {item.product.name}
          </Text>
          {!hasStock ? (
            <Text className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
              {t('menu.outOfStock')}
            </Text>
          ) : minPrice == null ? (
            <Text className="text-[13px] font-semibold text-primary">
              {t('menu.contactForPrice', 'Liên hệ')}
            </Text>
          ) : (
            <View className="flex-row flex-wrap items-baseline gap-x-1.5">
              <Text className="text-[13px] font-bold text-primary">
                {formatCurrency(minPrice * (1 - promo / 100))}
              </Text>
              {promo > 0 && (
                <Text className="text-[11px] text-gray-400 line-through">
                  {formatCurrency(minPrice)}
                </Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
    )
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.itemWidth === next.itemWidth &&
    prev.primaryColor === next.primaryColor,
)

function SliderRelatedProducts({
  currentProduct,
  catalog,
}: SliderRelatedProductsProps) {
  const { t } = useTranslation('menu')
  const router = useRouter()
  const setMenuFilter = useSetMenuFilter()
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
      // Chỉ lấy ít thẻ related cho nhẹ tải (BE hỗ trợ paging).
      page: 1,
      size: RELATED_FETCH_SIZE,
      hasPaging: true,
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

  const { visibleRelated, totalRelated } = useMemo(() => {
    const items = (
      hasUser
        ? extractMenuItems(relatedProducts?.result)
        : extractMenuItems(publicSpecificMenu?.result)
    ).filter((item) => item.slug !== currentProduct)
    return {
      visibleRelated: items.slice(0, VISIBLE_RELATED),
      totalRelated: items.length,
    }
  }, [
    hasUser,
    relatedProducts?.result,
    publicSpecificMenu?.result,
    currentProduct,
  ])

  const hasMoreRelated = totalRelated > VISIBLE_RELATED

  // Keep O(1) lookup map in sync
  useEffect(() => {
    const m = new Map<string, IMenuItem>()
    for (const item of visibleRelated) m.set(item.slug, item)
    itemsMapRef.current = m
  }, [visibleRelated])

  const isLoading = hasUser ? isPending : isPendingPublicSpecificMenu

  // ~2,4 thẻ trong màn: thẻ thứ ba lộ một phần để khách biết vuốt được.
  const { itemWidth, itemSpacing } = useMemo(() => {
    const w = Dimensions.get('window').width
    const padding = 16
    const gap = 12
    const width = Math.round((w - padding - gap * 2) / 2.4)
    return { itemWidth: width, itemSpacing: gap }
  }, [])

  const handleSeeMore = useCallback(() => {
    // Chọn catalog tương ứng rồi chuyển sang tab Menu.
    setMenuFilter((prev) => ({
      ...prev,
      catalog,
      isNewProduct: undefined,
      isTopSell: undefined,
    }))
    router.navigate(TAB_ROUTES.MENU)
  }, [catalog, setMenuFilter, router])

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
      .map((p) => getProductImageUrl(p, { maxWidth: IMAGE_PRESET.HERO }))
      .filter((u): u is string => !!u)

    // Hand the hero gallery to the detail screen via the transient store — the
    // detail reads gallery from here (not from params). Without this, entering
    // detail from a related item shows the PREVIOUS product's gallery.
    useTransientNavStore.getState().setHeroImageUrls(heroImageUrls)

    navigateNative.push({
      pathname: ROUTE.CLIENT_PRODUCT_DETAIL,
      params: {
        id: mi.slug,
        name: mi.product?.name ?? '',
        basePrice: String(minPrice),
        promotionValue: String(mi.promotion?.value ?? 0),
        imageUrl: heroImageUrls[0] ?? '',
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
      // Cùng luật với nút + ở Menu: hết hàng thì không thêm, chưa đăng nhập
      // thì mở đăng nhập.
      if (
        !hasMenuItemStock({
          isLocked: mi.isLocked,
          currentStock: mi.currentStock,
          isLimit: mi.product?.isLimit,
        })
      )
        return
      if (!useUserStore.getState().userInfo?.slug) {
        useLoginSheetStore.getState().open()
        return
      }
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
      // Nút + thêm size rẻ nhất — báo rõ size để khách không bất ngờ ở giỏ.
      showToast(
        orderItem.size
          ? t('menu.addedToCartWithSize', {
              name: orderItem.name,
              size: orderItem.size,
            })
          : t('menu.addedToCart', { name: orderItem.name }),
      )
    },
    [t],
  )

  const header = (
    <View className="mb-3 flex-row items-center justify-between pr-4">
      <Text className="text-base font-bold text-gray-900 dark:text-white">
        {t('menu.relatedProducts', 'Có thể bạn thích')}
      </Text>
      {hasMoreRelated && (
        <Pressable
          onPress={handleSeeMore}
          hitSlop={8}
          accessibilityRole="button"
          className="flex-row items-center active:opacity-70"
        >
          <Text
            className="text-[13px] font-semibold"
            style={{ color: primaryColor }}
          >
            {t('menu.seeMore', 'Xem thêm')}
          </Text>
          <ChevronRight size={16} color={primaryColor} />
        </Pressable>
      )}
    </View>
  )

  if (visibleRelated.length === 0) {
    if (!isLoading) return null
    return (
      <View style={{ marginTop: 16 }}>
        {header}
        <ScrollView
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={`skel-${i}`}
              style={{ width: itemWidth, marginRight: itemSpacing }}
            >
              <View
                className="rounded-2xl bg-gray-200 dark:bg-gray-800"
                style={{ width: itemWidth, height: itemWidth }}
              />
              <View className="gap-1.5 pt-2">
                <View className="h-3.5 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                <View className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={{ marginTop: 16 }}>
      {header}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={itemWidth + itemSpacing}
        contentContainerStyle={{ paddingRight: 16 - itemSpacing }}
      >
        {visibleRelated.map((item) => (
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
