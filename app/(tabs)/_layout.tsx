/**
 * Tabs layout — Home, Menu, Gift Card, Profile, Cart.
 *
 * Rẽ theo CÓ KÍNH hay không, không theo nền tảng:
 *
 * - iOS 26+ → thanh tab gốc (NativeTabs). Cart là tab thứ 5, mang dáng ô tròn
 *   tách rời bên phải qua role="search".
 * - Android và iOS dưới 26 → thanh tự vẽ, xem CustomTabsNavigator để biết vì
 *   sao thanh gốc ở hai nơi đó đều không dựng được thiết kế của app.
 */
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { usePathname } from 'expo-router'
import {
  Badge,
  Icon,
  Label,
  NativeTabs,
} from 'expo-router/unstable-native-tabs'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, View, useColorScheme } from 'react-native'

import { CustomTabsNavigator } from '@/components/navigation/custom-tabs-navigator'
import { OrderReadyPickupSheet } from '@/components/notification/order-ready-pickup-sheet'
import { usePredictivePrefetch } from '@/hooks'
import { useGlassEnabled } from '@/hooks/use-glass'
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
import { HAS_LIQUID_GLASS } from '@/utils/liquid-glass'
// import { ProfileNudgePopup } from '@/components/profile'

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
  const glass = useGlassEnabled()
  const cartItemCount = useOrderFlowCartItemCount()

  return (
    <View style={{ flex: 1 }}>
      {!HAS_LIQUID_GLASS ? (
        <CustomTabsNavigator />
      ) : (
        <NativeTabs
          tintColor={colors.primary}
          iconColor={{
            default: colors.mutedForeground,
            selected: colors.primary,
          }}
          // Có kính thì để undefined, cho UITabBarAppearance giữ Liquid Glass
          // gốc — đặt màu đặc ở đây sẽ làm mất hiệu ứng trong suốt.
          //
          // KHÔNG có kính thì BẮT BUỘC đặt màu: undefined ở iOS dưới 26 nghĩa
          // là không cấu hình nền nào cả, và thanh tab trong suốt hoàn toàn —
          // nội dung trang trôi xuyên qua sau chữ. Đã thấy trên iPhone 11 Pro
          // Max chạy iOS 18. Cùng lý do áp cho Android, và cho cả máy iOS 26
          // đang bật "Giảm độ trong suốt" trong Trợ năng.
          backgroundColor={glass ? undefined : colors.card}
          // Bắt buộc khi không có kính. Khi danh sách đang ở đầu trang, iOS
          // dùng scrollEdgeAppearance, mà expo-router ÉP nó trong suốt ở đó:
          // `backgroundColor: options.disableTransparentOnScrollEdge ? ... : null`
          // kèm `blurEffect: 'none'` (xem appearance.js:29-32,
          // createScrollEdgeAppearanceFromOptions). Trên iOS 26 hệ thống vẫn
          // vẽ kính nên không lộ; iOS dưới 26 thì trong suốt là trống trơn,
          // nội dung trang trôi xuyên qua sau chữ.
          disableTransparentOnScrollEdge={!glass}
          labelVisibilityMode="labeled"
          indicatorColor={colors.primary}
          minimizeBehavior="onScrollDown"
        >
          <NativeTabs.Trigger name="home">
            <Icon sf={{ default: 'house', selected: 'house.fill' }} />
            <Label>{t('tabs.home', 'Trang chủ')}</Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="menu">
            <Icon sf="fork.knife" />
            <Label>{t('tabs.menu', 'Thực đơn')}</Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="gift-card">
            <Icon sf={{ default: 'gift', selected: 'gift.fill' }} />
            <Label>{t('tabs.giftCard', 'Thẻ quà')}</Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="profile">
            <Icon sf={{ default: 'person', selected: 'person.fill' }} />
            <Label>{t('tabs.profile', 'Tài khoản')}</Label>
          </NativeTabs.Trigger>
          {/* role="search" — CHỦ Ý, đã chốt sau khi xem trên máy thật. Đây là
              cách DUY NHẤT để có dáng nút tròn tách rời bên phải thanh tab
              theo Apple HIG: nó map thẳng sang
              `UITabBarItem(tabBarSystemItem: .search)` ở native (xem
              RCTConvert+RNSBottomTabs.mm trong react-native-screens). Không có
              prop/API nào khác của NativeTabs tạo được hình dạng này.

              Không cần rào phiên bản: cả cây NativeTabs này chỉ dựng khi
              HAS_LIQUID_GLASS, tức iOS 26+.

              Đánh đổi đã biết và đã CHẤP NHẬN có ý thức:
              1. Nhãn do hệ thống tự đặt, không ghi đè được — ở bố cục có hiện
                 nhãn cạnh icon search (cỡ chữ trợ năng lớn) nó sẽ hiện
                 "Tìm kiếm"/"Search" chứ không phải text trong <Label>.
              2. VoiceOver đọc mục tab này là "Search", không phải "Giỏ hàng".
                 convertTabPropsToOptions() trong
                 node_modules/expo-router/build/native-tabs/NativeBottomTabs/NativeTabTrigger.js
                 không nhận/emit accessibilityLabel cho tab item — react-native-screens
                 phía native cũng không có chỗ nhận nó cho system item — nên
                 không có cách nào override từ phía app. */}
          <NativeTabs.Trigger name="cart" role="search">
            <Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
            {/* <Label> bị bỏ qua vì role="search" dùng nhãn hệ thống, nhưng
                vẫn giữ để expo-router có title cho route. */}
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
      )}

      <OrderReadyPickupSheet />
      {/* <ProfileNudgePopup /> */}
    </View>
  )
}
