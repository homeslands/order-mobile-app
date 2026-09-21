/**
 * Tabs layout.
 * iOS: Home, Menu, Gift Card, Profile, Cart (native tabs, cart tab thứ 5).
 * Android: Home, Menu, Gift Card, Profile (4 tab) — giỏ hàng là
 * FloatingCartButton tự vẽ, nổi cùng hàng bên phải thanh tab (xem lý do ở
 * TAB_ROUTES.CART trong constants/navigation.config.ts).
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
import { useOrderFlowCartItemCount } from '@/stores/selectors'
import { useNotificationStore } from '@/stores/notification.store'
import { supportsDetachedSearchTab as computeSupportsDetachedSearchTab } from '@/utils/platform-version'
// import { ProfileNudgePopup } from '@/components/profile'

const isAndroid = Platform.OS === 'android'

// Android: thanh tab nổi cách đáy safe area 10dp (khớp lề `bottom` trong
// patches/react-native-screens+4.16.0.patch, TabsHost.kt). FloatingCartButton
// cao 64dp (xem components/navigation/floating-cart-button.tsx) — căn giữa
// theo chiều dọc so với chiều cao thanh tab (NATIVE_TAB_BAR_HEIGHT, 80dp).
// Lề phải 12dp khớp lề trái mặc định của thanh tab; patch đã nới lề phải
// riêng của thanh tab lên 88dp (12 lề gốc + 64 nút + 12 khoảng hở) để nút
// không đè lên thanh tab.
const ANDROID_TAB_BAR_BOTTOM_MARGIN = 10
const ANDROID_CART_BUTTON_SIZE = 64
const ANDROID_CART_BUTTON_RIGHT = 12

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
  const insets = useSafeAreaInsets()
  const cartButtonBottom =
    insets.bottom +
    ANDROID_TAB_BAR_BOTTOM_MARGIN +
    (NATIVE_TAB_BAR_HEIGHT - ANDROID_CART_BUTTON_SIZE) / 2

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
        {/* Cart tab CHỈ khai báo trên iOS. Trên Android không thể đánh dấu
            trigger này `hidden` để giữ nó trong navigator nhưng ẩn khỏi
            thanh tab — trigger `hidden` bị `.filter()` loại HẲN khỏi
            navigator (xem node_modules/expo-router/build/useScreens.js:123),
            nên route đó không điều hướng tới được nữa. Vì vậy Android không
            khai báo trigger cart; giỏ hàng ở đó là FloatingCartButton tự vẽ,
            nổi cùng hàng bên phải thanh tab (xem render bên dưới) và điều
            hướng tới '/cart' ở stack gốc — xem TAB_ROUTES.CART. */}
        {!isAndroid && (
          // role="search" (iOS 26+ only) — CHỦ Ý, đã chốt sau khi xem trên máy
          // thật. Đây là cách DUY NHẤT để có dáng nút tròn tách rời bên phải
          // thanh tab theo Apple HIG (iOS 26): nó map thẳng sang
          // `UITabBarItem(tabBarSystemItem: .search)` ở native
          // (xem RCTConvert+RNSBottomTabs.mm trong react-native-screens).
          // Không có prop/API nào khác của NativeTabs tạo được hình dạng này.
          //
          // RÀO PHIÊN BẢN — quan trọng nhất, không phải chỉ iPad/cỡ chữ lớn:
          // `.search` là system item có sẵn từ lâu, chạy được trên mọi phiên
          // bản iOS (app hỗ trợ tối thiểu 15.1, xem ios/Podfile). Ô tròn tách
          // rời chỉ là hình dạng trên thanh tab kiểu iOS 26; ở bản thấp hơn,
          // thanh tab là dạng cổ điển và LUÔN hiện nhãn dưới icon — nếu vẫn
          // gán role="search" ở đó, người dùng sẽ thấy icon giỏ hàng kèm chữ
          // "Tìm kiếm" hệ thống thay vì "Giỏ hàng". Do đó chỉ bật role này khi
          // `supportsDetachedSearchTab` (iOS >= 26); các bản khác rơi về tab
          // thường, dùng đúng <Label> bên dưới.
          //
          // Đánh đổi đã biết và đã CHẤP NHẬN có ý thức (không phải bug, chỉ áp
          // dụng khi supportsDetachedSearchTab = true):
          // 1. Nhãn do hệ thống tự đặt, không ghi đè được — ở bố cục có hiện
          //    nhãn cạnh icon search (iPad, cỡ chữ trợ năng lớn) nó sẽ hiện
          //    "Tìm kiếm"/"Search" chứ không phải text trong <Label> bên dưới.
          // 2. VoiceOver đọc mục tab này là "Search", không phải "Giỏ hàng".
          //    convertTabPropsToOptions() trong
          //    node_modules/expo-router/build/native-tabs/NativeBottomTabs/NativeTabTrigger.js
          //    không nhận/emit accessibilityLabel cho tab item — react-native-screens
          //    phía native cũng không có chỗ nhận nó cho system item — nên
          //    không có cách nào override từ phía app.
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
        )}
      </NativeTabs>

      {/* Android: giỏ hàng KHÔNG phải tab, là nút tròn tự vẽ nổi ngang hàng
          thanh tab, ở bên phải. Dùng shouldHideCartButton (cùng luật ẩn cũ
          trước khi giỏ hàng từng được đưa vào (tabs)) để ẩn ở màn giỏ hàng,
          chi tiết món, thanh toán, sửa đơn, đăng nhập, và route con của
          Tài khoản. */}
      {isAndroid && !shouldHideCartButton(pathname, isAuthenticated) && (
        <View
          style={{
            position: 'absolute',
            right: ANDROID_CART_BUTTON_RIGHT,
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
