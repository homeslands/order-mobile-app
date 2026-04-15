import { ScreenContainer } from '@/components/layout'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { useFocusEffect } from '@react-navigation/native'
import { Image as ExpoImage } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { ShoppingCartIcon } from 'lucide-react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, TAB_ROUTES } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useOrderBySlug, useRunAfterTransition } from '@/hooks'
import { navigateNative, useGpuWarmup } from '@/lib/navigation'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { OrderStatus } from '@/types'

import OrderCountdownNative from './components/order-countdown-native'
import UpdateOrderContentNative from './components/update-order-content-native'
import UpdateOrderFooter from './components/update-order-footer'
import UpdateOrderMenus from './components/update-order-menus'
import UpdateOrderSkeleton from './components/update-order-skeleton'

export default function UpdateOrderScreen() {
  useGpuWarmup()
  const { t } = useTranslation('menu')
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const screenBg = isDark ? colors.background.dark : colors.background.light
  const insets = useSafeAreaInsets()

  const [allowFetch, setAllowFetch] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [shouldReinitialize, setShouldReinitialize] = useState(false)
  const [activeTab, setActiveTab] = useState<'order' | 'menu'>('order')
  // Guard: prevent concurrent poll requests if network is slow
  const isFetchingRef = React.useRef(false)

  const { data: orderResponse, isPending, refetch: refetchOrder } = useOrderBySlug(
    allowFetch ? slug : null,
  )
  const order = orderResponse?.result
  const initializeUpdating = useOrderFlowStore((s) => s.initializeUpdating)
  const clearUpdatingData = useOrderFlowStore((s) => s.clearUpdatingData)

  const branchFromOrder =
    typeof order?.branch === 'string'
      ? order.branch
      : (order?.branch as unknown as { slug?: string })?.slug
  const branchFromStore = useBranchStore((s) => s.branch?.slug)
  const userBranch = useUserStore((s) => s.userInfo?.branch?.slug)
  const branchSlug = branchFromOrder || branchFromStore || userBranch || ''

  // Shell-first: delay fetch until after transition
  useRunAfterTransition(() => setAllowFetch(true), [])

  // Clear image memory cache on blur (menu grid images)
  useFocusEffect(
    useCallback(() => {
      return () => {
        queueMicrotask(() => ExpoImage.clearMemoryCache())
      }
    }, []),
  )

  // Init updating data when order is valid
  useEffect(() => {
    if (!order || !slug || !allowFetch) return
    const isValidOrder = order.slug && order.orderItems && order.orderItems.length > 0
    if (isValidOrder && !isDataLoaded) {
      const run = () => {
        try {
          initializeUpdating(order)
          queueMicrotask(() => setIsDataLoaded(true))
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Update Order: Failed to initialize:', error)
        }
      }
      requestAnimationFrame(run)
    }
  }, [order, slug, allowFetch, isDataLoaded, initializeUpdating])

  // Reinitialize when refetch completes
  useEffect(() => {
    if (!shouldReinitialize || !order) return
    try {
      initializeUpdating(order)
      queueMicrotask(() => setShouldReinitialize(false))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Update Order: Reinitialize failed:', error)
    }
  }, [shouldReinitialize, order, initializeUpdating])

  // Polling when order is PENDING — guard prevents concurrent requests if network is slow.
  // Keep refetchOrder in a ref: react-query may return a new function reference per render,
  // which would otherwise tear down + recreate the interval each time.
  const refetchOrderRef = React.useRef(refetchOrder)
  useEffect(() => {
    refetchOrderRef.current = refetchOrder
  }, [refetchOrder])

  const isOrderPending = order?.status === OrderStatus.PENDING
  useEffect(() => {
    if (!isOrderPending || !isDataLoaded || isExpired) return
    const interval = setInterval(async () => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      try {
        const { data } = await refetchOrderRef.current()
        const updated = data?.result
        if (updated && updated.status !== OrderStatus.PENDING) {
          setShouldReinitialize(true)
        }
      } catch { /* ignore */ } finally {
        isFetchingRef.current = false
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [isOrderPending, isDataLoaded, isExpired])

  const handleExpire = useCallback(() => {
    setIsExpired(true)
    clearUpdatingData()
    setIsDataLoaded(false)
  }, [clearUpdatingData])

  const handleBack = useCallback(() => {
    navigateNative.back()
  }, [])

  const handleBackToMenu = useCallback(() => {
    navigateNative.replace(TAB_ROUTES.MENU)
  }, [])

  const handleTabOrder = useCallback(() => setActiveTab('order'), [])
  const handleTabMenu = useCallback(() => setActiveTab('menu'), [])

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (!allowFetch || isPending) {
    return <UpdateOrderSkeleton />
  }

  // ── Expired ─────────────────────────────────────────────────────────────────
  if (isExpired) {
    return (
      <ScreenContainer edges={['top']} style={[s.screen, { backgroundColor: screenBg }]}>
        <View style={[s.expiredHeader, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200], backgroundColor: isDark ? colors.gray[800] : colors.white.light }]}>
          <Pressable onPress={handleBack} hitSlop={8} style={s.backBtn}>
            <Text style={[s.backText, { color: isDark ? colors.gray[300] : colors.gray[600] }]}>‹</Text>
          </Pressable>
          <Text style={[s.headerTitle, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
            {t('order.updateOrder', 'Cập nhật đơn hàng')}
          </Text>
          <View style={s.backBtn} />
        </View>
        <View style={s.expiredBody}>
          <View style={s.expiredIconWrap}>
            <ShoppingCartIcon size={64} color={isDark ? colors.primary.light : colors.primary.dark} />
          </View>
          <Text style={[s.expiredTitle, { color: isDark ? colors.gray[200] : colors.gray[800] }]}>
            {t('order.orderExpired', 'Đơn hàng đã hết hạn cập nhật')}
          </Text>
          <Text style={[s.expiredSub, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
            {t('order.backToMenuNote', 'Vui lòng tạo đơn hàng mới từ thực đơn')}
          </Text>
          <Pressable
            onPress={handleBackToMenu}
            style={[s.expiredBtn, { backgroundColor: primaryColor }]}
          >
            <Text style={s.expiredBtnText}>{t('order.backToMenu', 'Về thực đơn')}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    )
  }

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: screenBg }]}>
      <ScreenContainer edges={['top']} style={{ flex: 1 }}>

        {/* Fixed area cleared for FloatingHeader: countdown + tab bar */}
        <View style={{ paddingTop: STATIC_TOP_INSET + 36 }}>
          {order?.createdAt && (
            <OrderCountdownNative
              createdAt={order.createdAt}
              setIsExpired={handleExpire}
            />
          )}
          <View style={[s.tabBar, {
            backgroundColor: isDark ? colors.gray[800] : colors.white.light,
            borderBottomColor: isDark ? colors.gray[700] : colors.gray[200],
          }]}>
            <Pressable
              onPress={handleTabOrder}
              style={[s.tab, activeTab === 'order' && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
            >
              <Text style={[s.tabText, { color: activeTab === 'order' ? primaryColor : (isDark ? colors.gray[400] : colors.gray[500]) }]}>
                {t('order.order', 'Đơn hàng')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleTabMenu}
              style={[s.tab, activeTab === 'menu' && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
            >
              <Text style={[s.tabText, { color: activeTab === 'menu' ? primaryColor : (isDark ? colors.gray[400] : colors.gray[500]) }]}>
                {t('menu.addMenuItem', 'Thêm món')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tab content */}
        {activeTab === 'order' ? (
          <UpdateOrderContentNative
            isDark={isDark}
            primaryColor={primaryColor}
          />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <UpdateOrderMenus branchSlug={branchSlug} primaryColor={primaryColor} />
          </ScrollView>
        )}

        {/* Footer: order type, table, voucher, total, confirm */}
        {activeTab === 'order' && (
          <UpdateOrderFooter
            orderSlug={slug || ''}
            isDark={isDark}
            primaryColor={primaryColor}
            insetBottom={insets.bottom}
          />
        )}

        {/* FloatingHeader — rendered last so it overlays content */}
        <FloatingHeader
          title={t('order.updateOrder', 'Cập nhật đơn hàng')}
          onBack={handleBack}
        
          disableBlur
        />
      </ScreenContainer>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  // ── Expired ────────────────────────────────────────────────────────────────
  expiredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, alignItems: 'center' },
  backText: { fontSize: 28, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  expiredBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  expiredIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(247,167,55,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  expiredTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  expiredSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  expiredBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 9999 },
  expiredBtnText: { fontSize: 15, fontWeight: '700', color: colors.white.light },
  // ── Tab bar ────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
})
