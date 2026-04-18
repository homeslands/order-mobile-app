/**
 * Tab Menu — FlashList + phase-gated images + ref-stable callbacks.
 * UI & logic ported from perf/index.tsx, store bridged to order-flow.
 */
import { getPublicSpecificMenu, getSpecificMenu } from '@/api/menu'
import { Images } from '@/assets/images'
import { SelectBranchDropdown } from '@/components/branch'
import { PriceFilterSheet } from '@/components/menu/price-sheet'
import { NotificationBell } from '@/components/notification/notification-bell'
import { TabScreenLayout } from '@/components/layout'
import { colors, OrderFlowStep } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useCatalog } from '@/hooks/use-catalog'
import { useMenuScreenState } from '@/hooks/use-menu-screen-state'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useOrderFlowStore, useUserStore } from '@/stores'
import { useSetMenuFilter } from '@/stores/selectors'
import type { ISpecificMenuRequest } from '@/types'
import { IOrderItem } from '@/types'
import { getProductImageUrl } from '@/utils/product-image-url'
import { showErrorToastMessage, showToast } from '@/utils/toast'
import { useFocusEffect } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  AppState,
  InteractionManager,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'

import type { CatalogChipData } from './menu-filter-bar'
import { MenuFilterBar } from './menu-filter-bar'
import type { MenuDisplayItem } from './menu-item-row'
import {
  MenuImagePhaseContext,
  MENU_ITEM_ESTIMATED_HEIGHT,
  MenuItemRow,
  menuViewabilityConfig,
} from './menu-item-row'

type FlatItem =
  | { _kind: 'header'; key: string; name: string }
  | { _kind: 'item'; data: MenuDisplayItem }

function overrideItemLayout(
  layout: { span?: number; size?: number },
  item: FlatItem,
) {
  layout.size = item._kind === 'header' ? 40 : MENU_ITEM_ESTIMATED_HEIGHT
}

const menuKeyExtractor = (item: FlatItem) =>
  item._kind === 'header' ? item.key : item.data.id

const MENU_IMAGE_PREFETCH_AHEAD_COUNT = 5
const MENU_IMAGE_PREFETCH_DEBOUNCE_MS = 100
const MENU_ENTRY_FETCH_DELAY_MS = 120
const MENU_ENTRY_IMAGE_DELAY_MS = 300
const ENABLE_SCROLL_PREFETCH = true
const SEARCH_DEBOUNCE_MS = 300
const PREFETCH_URL_CACHE_MAX = 256

/** Tiny LRU: evicts oldest entry when capacity exceeded — prevents unbounded growth */
function makeLruSet(max: number) {
  const map = new Map<string, true>()
  return {
    has: (key: string) => map.has(key),
    add: (key: string) => {
      if (map.has(key)) return
      if (map.size >= max) map.delete(map.keys().next().value as string)
      map.set(key, true)
    },
  }
}

export default function MenuPage() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { t } = useTranslation('menu')
  const { userSlug, isAuthenticated, menuFilter, branchSlug } =
    useMenuScreenState()
  const setMenuFilter = useSetMenuFilter()
  const [allowFetch, setAllowFetch] = useState(false)
  const [imagePhaseCount, setImagePhaseCount] = useState(0)

  // ── Order flow store bridge (read via getState to avoid re-render deps) ──

  // ── Search: local input + debounced filter keyword ──
  const [searchText, setSearchText] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setSearchKeyword(text.trim().toLowerCase())
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchText('')
    setSearchKeyword('')
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
  }, [])

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    },
    [],
  )

  // Stable ref map — handlers read from here instead of closing over itemsRaw.
  const itemsMapRef = React.useRef<Map<string, MenuDisplayItem>>(new Map())
  const itemsRawRef = React.useRef<MenuDisplayItem[]>([])
  const shouldClearMemoryCacheOnBlurRef = React.useRef(false)
  const hasUserStartedScrollRef = React.useRef(false)
  const hasLoadedImagesOnceRef = React.useRef(false)
  const prefetchedImageUrlsRef = React.useRef(
    makeLruSet(PREFETCH_URL_CACHE_MAX),
  )
  const prefetchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  useFocusEffect(
    useCallback(() => {
      setAllowFetch(false)
      const isFirstLoad = !hasLoadedImagesOnceRef.current
      if (isFirstLoad) setImagePhaseCount(0)

      let timer: ReturnType<typeof setTimeout> | null = null
      const task = InteractionManager.runAfterInteractions(() => {
        timer = setTimeout(
          () => {
            startTransition(() => {
              setAllowFetch(true)
              if (isFirstLoad) {
                setImagePhaseCount(Infinity)
                hasLoadedImagesOnceRef.current = true
              }
            })
          },
          isFirstLoad ? MENU_ENTRY_IMAGE_DELAY_MS : MENU_ENTRY_FETCH_DELAY_MS,
        )
      })

      return () => {
        task.cancel()
        if (timer) clearTimeout(timer)
        setAllowFetch(false)
      }
    }, []),
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('memoryWarning', () => {
      shouldClearMemoryCacheOnBlurRef.current = true
    })
    return () => {
      subscription.remove()
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!shouldClearMemoryCacheOnBlurRef.current) return
        shouldClearMemoryCacheOnBlurRef.current = false
        queueMicrotask(() => Image.clearMemoryCache())
        hasUserStartedScrollRef.current = false
      }
    }, []),
  )

  const hasUser = isAuthenticated && !!userSlug
  const hasBranch = !!menuFilter.branch || !!branchSlug

  // ── Catalog chips ──
  const { data: catalogRes } = useCatalog({ enabled: hasBranch })
  const catalogList = useMemo<CatalogChipData[]>(
    () =>
      catalogRes?.result?.map((c) => ({ slug: c.slug, name: c.name })) ?? [],
    [catalogRes],
  )
  const handleCatalogSelect = useCallback(
    (slug: string | undefined) => {
      setMenuFilter((prev) => ({
        ...prev,
        catalog: slug,
        isNewProduct: undefined,
        isTopSell: undefined,
      }))
    },
    [setMenuFilter],
  )

  const handleSpecialFilterSelect = useCallback(
    (key: 'isNewProduct' | 'isTopSell') => {
      setMenuFilter((prev) => {
        const active = !!prev[key]
        return {
          ...prev,
          catalog: undefined,
          isNewProduct: undefined,
          isTopSell: undefined,
          [key]: active ? undefined : true,
        }
      })
    },
    [setMenuFilter],
  )

  const [priceSheetVisible, setPriceSheetVisible] = useState(false)
  const handleOpenPriceSheet = useCallback(() => setPriceSheetVisible(true), [])
  const handleClosePriceSheet = useCallback(
    () => setPriceSheetVisible(false),
    [],
  )
  const handlePriceSelect = useCallback(
    (min: number, max: number) => {
      setMenuFilter((prev) => ({
        ...prev,
        minPrice: min,
        maxPrice: max,
      }))
    },
    [setMenuFilter],
  )

  const menuDate = menuFilter.date
  const menuBranch = menuFilter.branch
  const menuCatalog = menuFilter.catalog
  const menuProductName = menuFilter.productName
  const menuMinPrice = menuFilter.minPrice
  const menuMaxPrice = menuFilter.maxPrice
  const menuSlug = menuFilter.menu
  const menuIsNewProduct = menuFilter.isNewProduct
  const menuIsTopSell = menuFilter.isTopSell

  const request = useMemo<ISpecificMenuRequest>(
    () => ({
      date: menuDate ?? new Date().toISOString().split('T')[0],
      branch: menuBranch ?? branchSlug,
      catalog: menuCatalog,
      productName: menuProductName,
      minPrice: menuMinPrice,
      maxPrice: menuMaxPrice,
      slug: menuSlug,
      isNewProduct: menuIsNewProduct,
      isTopSell: menuIsTopSell,
    }),
    [
      menuDate,
      menuBranch,
      menuCatalog,
      menuProductName,
      menuMinPrice,
      menuMaxPrice,
      menuSlug,
      menuIsNewProduct,
      menuIsTopSell,
      branchSlug,
    ],
  )

  const {
    data: privateData,
    isFetching: isPrivateFetching,
    refetch: refetchPrivate,
  } = useQuery({
    queryKey: ['specific-menu', request],
    queryFn: () => getSpecificMenu(request),
    enabled: hasBranch && hasUser && allowFetch,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
  })
  const {
    data: publicData,
    isFetching: isPublicFetching,
    refetch: refetchPublic,
  } = useQuery({
    queryKey: ['public-specific-menu', request],
    queryFn: () => getPublicSpecificMenu(request),
    enabled: hasBranch && !hasUser && allowFetch,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
  })
  const isFetching = hasUser ? isPrivateFetching : isPublicFetching
  const menuData = hasUser ? privateData : publicData

  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    const refetch = hasUser ? refetchPrivate : refetchPublic
    refetch().finally(() => setIsRefreshing(false))
  }, [hasUser, refetchPrivate, refetchPublic])

  const itemsRaw = useMemo<MenuDisplayItem[]>(() => {
    const raw = menuData?.result?.menuItems ?? []
    return raw.map((item, index) => {
      const variants = item.product?.variants ?? []
      let minPrice = 0
      let cheapestVariantSlug = ''
      let cheapestVariantObj = variants.length > 0 ? variants[0] : null
      if (variants.length > 0) {
        minPrice = variants[0].price ?? 0
        cheapestVariantSlug = variants[0].slug ?? ''
        for (let i = 1; i < variants.length; i += 1) {
          const price = variants[i].price ?? 0
          if (price < minPrice) {
            minPrice = price
            cheapestVariantSlug = variants[i].slug ?? ''
            cheapestVariantObj = variants[i]
          }
        }
      }

      const heroImagePaths = [
        item.product?.image,
        ...(item.product?.images ?? []),
      ].filter((value): value is string => !!value)

      return {
        id: item.slug ?? item.product?.slug ?? `menu-item-${index}`,
        name: item.product?.name ?? 'Unnamed item',
        rawPrice: minPrice,
        promotionValue: item.promotion?.value ?? 0,
        imageUrl: getProductImageUrl(item.product?.image),
        heroImagePaths,
        listIndex: index,
        defaultVariantSlug: cheapestVariantSlug,
        menuItem: item,
        cheapestVariant: cheapestVariantObj,
        heroImageUrls: heroImagePaths
          .map((p) => getProductImageUrl(p))
          .filter((u): u is string => !!u),
      }
    })
  }, [menuData?.result?.menuItems])

  // Keep O(1) lookup map and raw ref in sync with latest items
  useEffect(() => {
    const m = new Map<string, MenuDisplayItem>()
    for (const item of itemsRaw) m.set(item.id, item)
    itemsMapRef.current = m
    itemsRawRef.current = itemsRaw
  }, [itemsRaw])

  // Pre-decode first visible images on the background thread as soon as data
  // arrives — eliminates Main Thread WebP decode when user scrolls down.
  const initialPrefetchDoneRef = React.useRef(false)
  useEffect(() => {
    if (imagePhaseCount === 0 || itemsRaw.length === 0) return
    if (initialPrefetchDoneRef.current) return
    initialPrefetchDoneRef.current = true
    const INITIAL_PREFETCH_COUNT = 8
    const urls: string[] = []
    for (
      let i = 0;
      i < Math.min(INITIAL_PREFETCH_COUNT, itemsRaw.length);
      i++
    ) {
      const url = itemsRaw[i].imageUrl
      if (url && !prefetchedImageUrlsRef.current.has(url)) {
        prefetchedImageUrlsRef.current.add(url)
        urls.push(url)
      }
    }
    if (urls.length > 0) Image.prefetch(urls).catch(() => {})
  }, [imagePhaseCount, itemsRaw])

  // Client-side filter — no API round-trip, instant UI response.
  const filteredItems = useMemo(() => {
    if (!searchKeyword) return itemsRaw
    return itemsRaw.filter((item) =>
      item.name.toLowerCase().includes(searchKeyword),
    )
  }, [itemsRaw, searchKeyword])

  // Flat list with catalog headers when "Tất cả" (no catalog filter, no search)
  // O(n) single-pass with Map instead of O(catalogs × n) nested filter

  const flatItems = useMemo<FlatItem[]>(() => {
    if (menuCatalog || searchKeyword || catalogList.length === 0) {
      return filteredItems.map((data) => ({ _kind: 'item' as const, data }))
    }
    const byCatalog = new Map<string, MenuDisplayItem[]>()
    const uncategorized: MenuDisplayItem[] = []
    for (const data of filteredItems) {
      const slug = data.menuItem.product.catalog?.slug
      if (!slug) {
        uncategorized.push(data)
        continue
      }
      const bucket = byCatalog.get(slug)
      if (bucket) {
        bucket.push(data)
      } else {
        byCatalog.set(slug, [data])
      }
    }
    const result: FlatItem[] = []
    for (const cat of catalogList) {
      const items = byCatalog.get(cat.slug)
      if (!items?.length) continue
      result.push({
        _kind: 'header',
        key: `header-${cat.slug}`,
        name: cat.name,
      })
      for (const data of items) result.push({ _kind: 'item', data })
    }
    for (const data of uncategorized) result.push({ _kind: 'item', data })
    return result
  }, [filteredItems, catalogList, menuCatalog, searchKeyword])

  const onViewableItemsChanged = useCallback(
    (info: { viewableItems: Array<{ index: number | null }> }) => {
      if (!ENABLE_SCROLL_PREFETCH) return

      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current)
      }

      prefetchTimeoutRef.current = setTimeout(() => {
        const visibleIndexes = info.viewableItems
          .map((entry) => entry.index)
          .filter((index): index is number => index != null && index >= 0)

        if (visibleIndexes.length === 0) {
          prefetchTimeoutRef.current = null
          return
        }

        const furthestVisibleIndex = Math.max(...visibleIndexes)
        const startIndex = furthestVisibleIndex + 1
        const endIndex = Math.min(
          itemsRawRef.current.length - 1,
          furthestVisibleIndex + MENU_IMAGE_PREFETCH_AHEAD_COUNT,
        )

        if (startIndex > endIndex) {
          prefetchTimeoutRef.current = null
          return
        }

        const urlsToPrefetch: string[] = []
        for (let i = startIndex; i <= endIndex; i += 1) {
          const imageUrl = itemsRawRef.current[i]?.imageUrl
          if (!imageUrl || prefetchedImageUrlsRef.current.has(imageUrl))
            continue
          prefetchedImageUrlsRef.current.add(imageUrl)
          urlsToPrefetch.push(imageUrl)
        }

        if (urlsToPrefetch.length > 0) {
          Image.prefetch(urlsToPrefetch).catch(() => {})
        }
        prefetchTimeoutRef.current = null
      }, MENU_IMAGE_PREFETCH_DEBOUNCE_MS)
    },
    [],
  )

  useEffect(
    () => () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current)
      }
    },
    [],
  )

  // Stable handlers: read from ref, no itemsRaw dep → renderItem reference
  // never changes on background refetch → FlashList skips full re-render.
  const handleOpenDetail = useCallback(
    (itemId: string) => {
      const selectedItem = itemsMapRef.current.get(itemId)
      if (!selectedItem) return

      router.push({
        pathname: '/(tabs)/menu/product/[id]',
        params: {
          id: selectedItem.id,
          name: selectedItem.name,
          basePrice: String(selectedItem.rawPrice),
          promotionValue: String(selectedItem.promotionValue),
          imageUrl: selectedItem.imageUrl ?? '',
          imageUrls: JSON.stringify(selectedItem.heroImageUrls),
        },
      })
    },
    [router],
  )

  const handleAddToCart = useCallback(
    (itemId: string) => {
      if (!useUserStore.getState().userInfo?.slug) {
        showErrorToastMessage('toast.unloggedIn')
        router.push('/auth/login' as Parameters<typeof router.push>[0])
        return
      }

      const displayItem = itemsMapRef.current.get(itemId)
      if (!displayItem) return

      // Read store state at call time — no hook deps, no re-render cascade
      const store = useOrderFlowStore.getState()
      if (!store.isHydrated) return
      if (store.currentStep !== OrderFlowStep.ORDERING) {
        store.setCurrentStep(OrderFlowStep.ORDERING)
      }
      if (!store.orderingData) {
        store.initializeOrdering()
      }
      const userSlug = useUserStore.getState().userInfo?.slug
      if (userSlug && !store.orderingData?.owner?.trim()) {
        store.initializeOrdering()
      }

      const mi = displayItem.menuItem
      const variants = mi.product?.variants ?? []
      const cheapestVariant = displayItem.cheapestVariant

      if (!cheapestVariant) return

      const orderItem: IOrderItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        slug: mi.product?.slug || '',
        image: mi.product?.image || '',
        name: mi.product?.name || '',
        quantity: 1,
        size: cheapestVariant.size?.name || '',
        allVariants: variants,
        variant: cheapestVariant,
        originalPrice: cheapestVariant.price,
        productSlug: mi.product?.slug || '',
        description: mi.product?.description || '',
        isLimit: mi.product?.isLimit || false,
        isGift: mi.product?.isGift || false,
        promotion: mi.promotion ? mi.promotion : null,
        promotionValue: mi.promotion ? mi.promotion.value : 0,
        note: '',
      }

      store.addOrderingItem(orderItem)
      showToast(t('menu.addedToCart', { name: displayItem.name }))
    },
    [t, router],
  )

  const catalogHeaderColor = isDark ? colors.gray[400] : colors.gray[500]

  const renderItem = useCallback(
    ({ item }: { item: FlatItem }) => {
      if (item._kind === 'header') {
        return (
          <Text style={[styles.catalogHeader, { color: catalogHeaderColor }]}>
            {item.name}
          </Text>
        )
      }
      const { data } = item
      return (
        <MenuItemRow
          id={data.id}
          name={data.name}
          imageUrl={data.imageUrl}
          listIndex={data.listIndex}
          rawPrice={data.rawPrice}
          promotionValue={data.promotionValue}
          primaryColor={primaryColor}
          isDark={isDark}
          onDetail={handleOpenDetail}
          onAddToCart={handleAddToCart}
        />
      )
    },
    [
      handleOpenDetail,
      handleAddToCart,
      primaryColor,
      isDark,
      catalogHeaderColor,
    ],
  )

  const handleScrollBeginDrag = useCallback(() => {
    hasUserStartedScrollRef.current = true
  }, [])

  return (
    <TabScreenLayout>
      {/* Header + filter — static, solid bg */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? colors.gray[900] : '#ffffff',
            paddingTop: STATIC_TOP_INSET + 12,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Image
            source={Images.Brand.Logo}
            contentFit="contain"
            style={styles.logo}
          />
          <View style={styles.headerRight}>
            <NotificationBell
              color={
                isDark
                  ? colors.mutedForeground.dark
                  : colors.mutedForeground.light
              }
            />
            <SelectBranchDropdown />
          </View>
        </View>
        {hasBranch && (
          <MenuFilterBar
            searchText={searchText}
            onSearchChange={handleSearchChange}
            onSearchClear={handleSearchClear}
            catalogs={catalogList}
            selectedCatalog={menuCatalog}
            onCatalogSelect={handleCatalogSelect}
            isNewProduct={menuIsNewProduct}
            isTopSell={menuIsTopSell}
            onSpecialFilterSelect={handleSpecialFilterSelect}
            currentMinPrice={menuMinPrice ?? 0}
            currentMaxPrice={menuMaxPrice ?? 300_000}
            primaryColor={primaryColor}
            isDark={isDark}
            onOpenPriceSheet={handleOpenPriceSheet}
            searchPlaceholder={t('menu.searchProduct')}
            allLabel={t('menu.all')}
            specialChipLabels={{
              isTopSell: t('menu.isTopSell'),
              isNewProduct: t('menu.isNewProduct'),
            }}
          />
        )}
      </View>

      {!hasBranch ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('menu.selectBranchPrompt')}</Text>
        </View>
      ) : (
        <MenuImagePhaseContext.Provider value={imagePhaseCount}>
          <FlashList
            data={flatItems}
            renderItem={renderItem}
            keyExtractor={menuKeyExtractor}
            getItemType={(item) => item._kind}
            overrideItemLayout={overrideItemLayout}
            drawDistance={300}
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={primaryColor}
                colors={[primaryColor]}
              />
            }
            onScrollBeginDrag={handleScrollBeginDrag}
            onViewableItemsChanged={
              ENABLE_SCROLL_PREFETCH ? onViewableItemsChanged : undefined
            }
            viewabilityConfig={menuViewabilityConfig}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {isFetching
                    ? t('menu.loadingMenu')
                    : searchKeyword
                      ? t('menu.searchNotFound', { keyword: searchText })
                      : t('menu.noMenuData')}
                </Text>
              </View>
            }
          />
        </MenuImagePhaseContext.Provider>
      )}

      <PriceFilterSheet
        key={priceSheetVisible ? 'open' : 'closed'}
        visible={priceSheetVisible}
        onClose={handleClosePriceSheet}
        currentMin={menuMinPrice ?? 0}
        currentMax={menuMaxPrice ?? 300_000}
        primaryColor={primaryColor}
        isDark={isDark}
        onSelect={handlePriceSelect}
        labels={{
          title: t('menu.priceRange'),
          reset: t('menu.reset'),
          from: t('menu.from'),
          to: t('menu.to'),
          quickSelect: t('menu.quickSelect'),
          apply: t('menu.apply'),
          allPrices: t('menu.allPrices'),
        }}
      />
    </TabScreenLayout>
  )
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  logo: {
    height: 32,
    width: 112,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 160,
  },
  emptyBox: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: colors.gray[100],
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray[500],
  },
  catalogHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
})
