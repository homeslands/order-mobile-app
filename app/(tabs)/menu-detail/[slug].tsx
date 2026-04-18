import { Image as ExpoImage } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { ChevronLeft, ShoppingCart } from 'lucide-react-native'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'

import { Images } from '@/assets/images'
import { MenuItemQuantityControl } from '@/components/menu'
import { CartBadge } from '@/components/navigation/cart-badge'
import { NativeGesturePressable } from '@/components/navigation/native-gesture-pressable'
import { Skeleton } from '@/components/ui'
import {
  getProductImageUrl,
  PRODUCT_IMAGE_MAX_WIDTH_DETAIL,
} from '@/utils/product-image-url'
import { TAB_ROUTES } from '@/constants/navigation.config'
import {
  useOrderFlowAddToCart,
  useRunAfterTransition,
  useSpecificMenuItem,
} from '@/hooks'
import { useMasterTransitionOptional } from '@/lib/navigation/master-transition-provider'
import { colors } from '@/constants'
import { getThemeColor } from '@/lib/utils'
import type { IMenuItem } from '@/types'
import { formatCurrency } from '@/utils'

export default function MenuItemDetailPlaceholder() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { t } = useTranslation('product')
  const onAddToCart = useOrderFlowAddToCart()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = getThemeColor(isDark).primary
  const masterTransition = useMasterTransitionOptional()

  const [allowFetch, setAllowFetch] = useState(false)
  const [isContentReady, setIsContentReady] = useState(false)

  useRunAfterTransition(() => setAllowFetch(true), [])

  // Defer query + content 100ms sau transition (Native Stack) — tránh FPS drop, đồng bộ với app/menu/[slug]
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => setIsContentReady(true), 100)
    })
    return () => {
      task.cancel()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  /** Image Memory: Khi pop — clear memory cache để RAM hạ ngay (defer tránh block unmount) */
  useEffect(() => {
    return () => {
      queueMicrotask(() => ExpoImage.clearMemoryCache())
    }
  }, [])

  const enabled = allowFetch && isContentReady && !!slug
  const { data, isLoading } = useSpecificMenuItem(slug || '', enabled)

  useEffect(() => {
    if (!isLoading && masterTransition?.hideLoadingOverlay) {
      masterTransition.hideLoadingOverlay()
    }
  }, [isLoading, masterTransition])

  const productDetail = data?.result

  const minPrice = useMemo(() => {
    const variants = productDetail?.product.variants ?? []
    if (!variants.length) return 0
    return Math.min(...variants.map((v) => v.price))
  }, [productDetail?.product.variants])

  const imageUrl = useMemo(() => {
    const img = productDetail?.product.image
    if (!img) return ''
    return (
      getProductImageUrl(img, {
        maxWidth: PRODUCT_IMAGE_MAX_WIDTH_DETAIL || undefined,
      }) ?? ''
    )
  }, [productDetail?.product.image])

  const hasStock = useMemo(() => {
    const currentStock = productDetail?.currentStock ?? 0
    const isLimit = productDetail?.product.isLimit
    return currentStock > 0 || !isLimit
  }, [productDetail?.currentStock, productDetail?.product.isLimit])

  const showSkeleton =
    !allowFetch || !isContentReady || isLoading || !productDetail

  return (
    <View style={styles.container}>
      {/* Header: back - logo - cart */}
      <View style={styles.header}>
        <NativeGesturePressable
          navigation={{ type: 'back' }}
          hapticStyle="light"
        >
          <View style={styles.iconButton}>
            <ChevronLeft size={18} color={colors.gray[900]} />
          </View>
        </NativeGesturePressable>
        <ExpoImage
          source={Images.Brand.Logo}
          style={styles.logo}
          contentFit="contain"
          recyclingKey="brand-logo"
        />
        <NativeGesturePressable
          navigation={{
            type: 'replace',
            href: TAB_ROUTES.CART,
          }}
          hapticStyle="light"
        >
          <View style={styles.iconButton}>
            <ShoppingCart size={18} color={colors.gray[900]} />
            <CartBadge />
          </View>
        </NativeGesturePressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {showSkeleton ? (
            <View>
              <Skeleton style={styles.skeletonImage} />
              <Skeleton style={styles.skeletonTitle} />
              <Skeleton style={styles.skeletonPrice} />
              <Skeleton style={styles.skeletonLine1} />
              <Skeleton style={styles.skeletonLine2} />
              <View style={styles.skeletonButtonWrap}>
                <Skeleton style={styles.skeletonButton} />
              </View>
            </View>
          ) : (
            <View>
              {/* Ảnh */}
              <View style={styles.imageContainer}>
                {imageUrl ? (
                  <ExpoImage
                    source={{ uri: imageUrl }}
                    style={styles.image}
                    contentFit="cover"
                    cachePolicy="disk"
                    recyclingKey={slug ?? imageUrl}
                  />
                ) : (
                  <View style={styles.imagePlaceholder} />
                )}
              </View>

              {/* Tên & giá */}
              <View style={styles.titleSection}>
                <Text style={styles.productName} numberOfLines={2}>
                  {productDetail.product.name}
                </Text>
                <Text style={[styles.price, { color: primaryColor }]}>
                  {minPrice > 0
                    ? formatCurrency(minPrice)
                    : t('product.contact', 'Liên hệ')}
                </Text>
              </View>

              {/* Mô tả ngắn */}
              {productDetail.product.description ? (
                <View>
                  <Text style={styles.description} numberOfLines={4}>
                    {productDetail.product.description}
                  </Text>
                </View>
              ) : null}

              {/* Nút Add to cart */}
              <View style={styles.addButtonWrap}>
                <MenuItemQuantityControl
                  item={productDetail as unknown as IMenuItem}
                  hasStock={hasStock}
                  isMobile={true}
                  onAddToCart={onAddToCart}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white.light,
  },
  logo: { height: 32, width: 112 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  skeletonImage: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    marginBottom: 16,
  },
  skeletonTitle: {
    width: '70%',
    height: 22,
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonPrice: {
    width: 120,
    height: 20,
    borderRadius: 6,
    marginBottom: 16,
  },
  skeletonLine1: {
    width: '90%',
    height: 14,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonLine2: {
    width: '80%',
    height: 14,
    borderRadius: 4,
    marginBottom: 24,
  },
  skeletonButtonWrap: { alignItems: 'flex-end' },
  skeletonButton: { width: 40, height: 40, borderRadius: 20 },
  imageContainer: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.gray[100],
    marginBottom: 16,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, backgroundColor: colors.gray[200] },
  titleSection: { marginBottom: 16 },
  productName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  price: { fontSize: 18, fontWeight: '700' },
  description: {
    fontSize: 14,
    color: colors.gray[600],
    lineHeight: 20,
    marginBottom: 24,
  },
  addButtonWrap: { alignItems: 'flex-end' },
})
