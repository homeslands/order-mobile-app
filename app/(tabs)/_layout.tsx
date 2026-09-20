/**
 * Tabs layout — Home, Menu, Cart, Gift Card, Profile (native tabs).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { usePathname } from 'expo-router'
import {
  Badge,
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from 'expo-router/unstable-native-tabs'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, View, useColorScheme } from 'react-native'

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
import { useOrderFlowCartItemCount } from '@/stores/selectors'
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
  const cartItemCount = useOrderFlowCartItemCount()

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs
        tintColor={colors.primary}
        iconColor={{
          default: colors.mutedForeground,
          selected: isAndroid ? '#ffffff' : colors.primary,
        }}
        // iOS: undefined để giữ kính Liquid Glass gốc của UITabBarAppearance —
        // đặt màu đặc ở đây sẽ làm mất hiệu ứng trong suốt. Android: bắt buộc
        // đặt màu, nếu không nó lấy màu Material You theo hình nền máy.
        backgroundColor={isAndroid ? colors.card : undefined}
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
        {/* role="search" (iOS only) — CHỦ Ý, đã chốt sau khi xem trên máy thật.
            Đây là cách DUY NHẤT để có dáng nút tròn tách rời bên phải thanh
            tab theo Apple HIG (iOS 26): nó map thẳng sang
            `UITabBarItem(tabBarSystemItem: .search)` ở native
            (xem RCTConvert+RNSBottomTabs.mm trong react-native-screens).
            Không có prop/API nào khác của NativeTabs tạo được hình dạng này.

            Đánh đổi đã biết và đã CHẤP NHẬN có ý thức (không phải bug):
            1. Nhãn do hệ thống tự đặt, không ghi đè được — ở bố cục có hiện
               nhãn cạnh icon search (iPad, cỡ chữ trợ năng lớn) nó sẽ hiện
               "Tìm kiếm"/"Search" chứ không phải text trong <Label> bên dưới.
            2. VoiceOver đọc mục tab này là "Search", không phải "Giỏ hàng".
               convertTabPropsToOptions() trong
               node_modules/expo-router/build/native-tabs/NativeBottomTabs/NativeTabTrigger.js
               không nhận/emit accessibilityLabel cho tab item — react-native-screens
               phía native cũng không có chỗ nhận nó cho system item — nên
               không có cách nào override từ phía app.
            Android không có khái niệm "search tab" trong Material You, nên
            role=undefined ở đó, giữ nguyên tab thường. */}
        <NativeTabs.Trigger name="cart" role={isAndroid ? undefined : 'search'}>
          {isAndroid ? (
            <Icon
              src={<VectorIcon family={MaterialIcons} name="shopping-cart" />}
            />
          ) : (
            <Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
          )}
          {/* <Label> vẫn cần giữ dù iOS bỏ qua nó (dùng nhãn hệ thống của
              role="search") — Android không có role này nên vẫn hiện nhãn
              "Giỏ hàng" bình thường. */}
          <Label>{t('tabs.cart', 'Giỏ hàng')}</Label>
          {/* Giữ nguyên dạng `cartItemCount > 0 && <Badge>`, KHÔNG đổi sang
              `<Badge hidden={cartItemCount === 0}>`: appendBadgeOptions()
              trong node_modules/expo-router/build/native-tabs/NativeBottomTabs/NativeTabTrigger.js
              cố tình set badgeValue = ' ' (một khoảng trắng) bất cứ khi nào
              `!props.children && !props.hidden` — tức Badge vẫn render
              children rỗng nhưng hidden=false sẽ hiện một badge trống thay
              vì ẩn hẳn. */}
          {cartItemCount > 0 && <Badge>{String(cartItemCount)}</Badge>}
        </NativeTabs.Trigger>
      </NativeTabs>

      <OrderReadyPickupSheet />
      {/* <ProfileNudgePopup /> */}
    </View>
  )
}
