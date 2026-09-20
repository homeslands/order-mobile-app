/**
 * Tabs layout — Home, Menu, Gift Card, Profile (native tabs).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { usePathname } from 'expo-router'
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from 'expo-router/unstable-native-tabs'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NATIVE_TAB_BAR_HEIGHT } from '@/components/layout/tab-screen-layout'
import { shouldHideCartButton } from '@/components/navigation/cart-button-visibility'
import { FloatingCartButton } from '@/components/navigation/floating-cart-button'
import { OrderReadyPickupSheet } from '@/components/notification/order-ready-pickup-sheet'
import { usePredictivePrefetch } from '@/hooks'
import { useNotifications } from '@/hooks/use-notification'
import { useMasterTransitionOptional } from '@/lib/navigation'
import { getThemeColor } from '@/lib/utils'
import {
  useAuthStore,
  useBranchStore,
  useMenuFilterStore,
  useUserStore,
} from '@/stores'
import { useNotificationStore } from '@/stores/notification.store'
// import { ProfileNudgePopup } from '@/components/profile'

const isAndroid = Platform.OS === 'android'

export default function TabsLayout() {
  const { t } = useTranslation('tabs')
  const pathname = usePathname()
  usePredictivePrefetch()
  const isDark = useColorScheme() === 'dark'
  const prevPathnameRef = useRef(pathname)
  const masterTransition = useMasterTransitionOptional()
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  // ── Bootstrap notification badge on app start ────────────────────────────
  // Fetch first page of notifications ngay khi đã login để badge hiện đúng
  // mà không cần user phải mở màn thông báo trước.
  const { data: bootstrapNotifData } = useNotifications(
    { receiver: userSlug, page: 1, size: 20 },
    { enabled: isAuthenticated && !!userSlug },
  )
  // Narrow dep to the actual array reference — React Query produces a new
  // wrapper object on every refetch even when contents are identical, so
  // depending on `bootstrapNotifData` would re-run hydrateFromApi on every
  // poll. structuralSharing keeps items stable when unchanged.
  const bootstrapNotifItems = bootstrapNotifData?.result?.items
  useEffect(() => {
    if (bootstrapNotifItems && bootstrapNotifItems.length > 0) {
      useNotificationStore.getState().hydrateFromApi(bootstrapNotifItems)
    }
  }, [bootstrapNotifItems])

  // useLayoutEffect: overlay chỉ khi Home→Menu và chưa cache (chờ data)
  // Đọc menuFilter, branchSlug, userSlug qua getState() — giảm subscriptions
  useLayoutEffect(() => {
    const prev = prevPathnameRef.current
    const wasHome =
      !prev?.includes('/menu') &&
      !prev?.includes('/cart') &&
      !prev?.includes('/gift-card') &&
      !prev?.includes('/profile')
    const isNowMenu = pathname?.includes('/menu')
    prevPathnameRef.current = pathname

    if (!masterTransition) return

    const wasFromDetailScreen = /(?:^|\/)(product|update-order|payment)\//.test(
      prev ?? '',
    )
    if (wasFromDetailScreen) return

    if (isNowMenu) {
      const menuFilter = useMenuFilterStore.getState().menuFilter
      const branchSlug = useBranchStore.getState().branch?.slug
      const userSlug = useUserStore.getState().userInfo?.slug
      const hasUser = isAuthenticated && !!userSlug
      const hasBranch = !!menuFilter.branch || !!branchSlug
      if (hasBranch) {
        const menuRequest = {
          date: menuFilter.date ?? dayjs().format('YYYY-MM-DD'),
          branch: menuFilter.branch ?? branchSlug,
          catalog: menuFilter.catalog,
          productName: menuFilter.productName,
          minPrice: menuFilter.minPrice,
          maxPrice: menuFilter.maxPrice,
          slug: menuFilter.menu,
        }
        const cacheKey = hasUser
          ? ['specific-menu', menuRequest]
          : ['public-specific-menu', menuRequest]
        const cached = queryClient.getQueryData(cacheKey)
        if (cached) return
      }
      if (wasHome && hasBranch) {
        requestAnimationFrame(() => {
          masterTransition.showLoadingOverlay()
        })
      }
    }
  }, [pathname, masterTransition, queryClient, isAuthenticated])

  const colors = useMemo(() => getThemeColor(isDark), [isDark])
  const insets = useSafeAreaInsets()
  const cartButtonBottom = insets.bottom + NATIVE_TAB_BAR_HEIGHT + 12

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs
        tintColor={colors.primary}
        iconColor={{
          default: colors.mutedForeground,
          selected: isAndroid ? '#ffffff' : colors.primary,
        }}
        backgroundColor={colors.card}
        labelVisibilityMode="labeled"
        indicatorColor={colors.primary}
        minimizeBehavior="onScrollDown"
      >
        <NativeTabs.Trigger name="home">
          {isAndroid ? (
            <Icon src={<VectorIcon family={MaterialIcons} name="home" />} />
          ) : (
            <Icon sf={{ default: 'house', selected: 'house.fill' }} />
          )}
          <Label>{t('tabs.home', 'Trang chủ')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="menu">
          {isAndroid ? (
            <Icon
              src={<VectorIcon family={MaterialIcons} name="restaurant-menu" />}
            />
          ) : (
            <Icon sf="fork.knife" />
          )}
          <Label>{t('tabs.menu', 'Thực đơn')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="gift-card">
          {isAndroid ? (
            <Icon
              src={<VectorIcon family={MaterialIcons} name="card-giftcard" />}
            />
          ) : (
            <Icon sf={{ default: 'gift', selected: 'gift.fill' }} />
          )}
          <Label>{t('tabs.giftCard', 'Thẻ quà')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          {isAndroid ? (
            <Icon src={<VectorIcon family={MaterialIcons} name="person" />} />
          ) : (
            <Icon sf={{ default: 'person', selected: 'person.fill' }} />
          )}
          <Label>{t('tabs.profile', 'Tài khoản')}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {!shouldHideCartButton(pathname, isAuthenticated) && (
        <View
          style={{
            position: 'absolute',
            right: 16,
            bottom: cartButtonBottom,
          }}
          pointerEvents="box-none"
        >
          <FloatingCartButton primaryColor={colors.primary} />
        </View>
      )}

      <OrderReadyPickupSheet />
      {/* <ProfileNudgePopup /> */}
    </View>
  )
}
