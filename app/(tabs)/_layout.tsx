/**
 * Tabs layout — Home, Menu, Gift Card, Profile, Cart.
 *
 * iOS (và web): thanh tab gốc của hệ điều hành (NativeTabs). Cart là tab thứ
 * 5, mang dáng ô tròn tách rời bên phải trên iOS 26+ qua role="search".
 *
 * Android: thanh tab tự vẽ — xem AndroidTabsNavigator để biết vì sao thanh
 * gốc Material 3 không dựng được thiết kế của app.
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

import { AndroidTabsNavigator } from '@/components/navigation/android-tabs-navigator'
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
import { supportsDetachedSearchTab as computeSupportsDetachedSearchTab } from '@/utils/platform-version'
// import { ProfileNudgePopup } from '@/components/profile'

const isAndroid = Platform.OS === 'android'

// role="search" map thẳng sang UITabBarItem.SystemItem.search — API này tồn
// tại từ rất lâu, KHÔNG chỉ trên iOS 26, nên tự nó không rào theo phiên bản.
// Dáng ô tròn tách rời chỉ xuất hiện trên thanh tab kiểu iOS 26; ở bản thấp
// hơn (app hỗ trợ tối thiểu 15.1, xem ios/Podfile) thanh tab là dạng cổ điển
// và LUÔN hiện nhãn dưới icon — nhãn đó do hệ thống tự đặt cho system item
// ("Tìm kiếm"/"Search"), bỏ qua <Label> (xem RNSBottomTabsScreenComponentView.mm,
// updateTabBarItem: khi _systemItem != None thì không gán tabBarItem.title).
// Nếu không rào ở đây, người dùng iOS 15–18 sẽ thấy icon giỏ hàng kèm chữ
// "Tìm kiếm" thay vì "Giỏ hàng". Phép so sánh phiên bản (Platform.Version là
// string trên iOS, vd. "17.4.1", khác Android — xem PlatformIOSStatic trong
// react-native/Libraries/Utilities/Platform.d.ts) được tách thành hàm thuần
// `supportsDetachedSearchTab` trong utils/platform-version.ts để test độc
// lập với các chuỗi phiên bản (xem __tests__/utils/platform-version.test.ts).
const supportsDetachedSearchTab = computeSupportsDetachedSearchTab(
  Platform.OS,
  Platform.Version,
)

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
      {isAndroid ? (
        <AndroidTabsNavigator />
      ) : (
        <NativeTabs
          tintColor={colors.primary}
          iconColor={{
            default: colors.mutedForeground,
            selected: colors.primary,
          }}
          // undefined để giữ kính Liquid Glass gốc của UITabBarAppearance —
          // đặt màu đặc ở đây sẽ làm mất hiệu ứng trong suốt.
          backgroundColor={undefined}
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
          {/* role="search" (iOS 26+ only) — CHỦ Ý, đã chốt sau khi xem trên máy
              thật. Đây là cách DUY NHẤT để có dáng nút tròn tách rời bên phải
              thanh tab theo Apple HIG (iOS 26): nó map thẳng sang
              `UITabBarItem(tabBarSystemItem: .search)` ở native
              (xem RCTConvert+RNSBottomTabs.mm trong react-native-screens).
              Không có prop/API nào khác của NativeTabs tạo được hình dạng này.

              RÀO PHIÊN BẢN — xem chú thích ở supportsDetachedSearchTab phía
              trên: iOS < 26 vẫn vẽ thanh tab cổ điển kèm nhãn hệ thống
              "Tìm kiếm", nên chỉ bật role này từ iOS 26.

              Đánh đổi đã biết và đã CHẤP NHẬN có ý thức (chỉ áp dụng khi
              supportsDetachedSearchTab = true):
              1. Nhãn do hệ thống tự đặt, không ghi đè được — ở bố cục có hiện
                 nhãn cạnh icon search (iPad, cỡ chữ trợ năng lớn) nó sẽ hiện
                 "Tìm kiếm"/"Search" chứ không phải text trong <Label> bên dưới.
              2. VoiceOver đọc mục tab này là "Search", không phải "Giỏ hàng".
                 convertTabPropsToOptions() trong
                 node_modules/expo-router/build/native-tabs/NativeBottomTabs/NativeTabTrigger.js
                 không nhận/emit accessibilityLabel cho tab item — react-native-screens
                 phía native cũng không có chỗ nhận nó cho system item — nên
                 không có cách nào override từ phía app. */}
          <NativeTabs.Trigger
            name="cart"
            role={supportsDetachedSearchTab ? 'search' : undefined}
          >
            <Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
            {/* <Label> vẫn cần giữ dù iOS 26+ bỏ qua nó (dùng nhãn hệ thống của
                role="search") — iOS < 26 không có role này nên vẫn hiện nhãn
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
      )}

      <OrderReadyPickupSheet />
      {/* <ProfileNudgePopup /> */}
    </View>
  )
}
