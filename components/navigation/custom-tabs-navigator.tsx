/**
 * Thanh tab tự vẽ — dùng ở mọi nơi KHÔNG có Liquid Glass.
 *
 * Tức Android và iOS dưới 26. Chỉ iOS 26+ mới dùng thanh tab gốc (NativeTabs,
 * xem app/(tabs)/_layout.tsx); rẽ nhánh theo HAS_LIQUID_GLASS chứ không theo
 * nền tảng.
 *
 * Vì sao Android không dùng thanh gốc: Material 3 vẽ viên chỉ báo BỌC RIÊNG
 * ICON — `activeIndicatorView` nằm trong `iconContainer`, còn `labelGroup` là
 * view anh em (xem NavigationBarItemView trong
 * com.google.android.material:material:1.12.0). Thiết kế của app cần viên bọc
 * CẢ icon lẫn nhãn xếp dọc. Bản 1.14 có `setItemIconGravity(START)` cho viên
 * bọc cả hai nhưng nằm NGANG — vẫn khác.
 *
 * Vì sao iOS dưới 26 cũng dùng bản này: `UITabBar` ở đó là thanh chạy hết
 * chiều ngang, không có API nào làm nó thành viên nổi — viên nổi là thiết kế
 * riêng của iOS 26.
 *
 * Đánh đổi chung: chuyển tab chạy qua JS thay vì native.
 */
import { LinearGradient } from 'expo-linear-gradient'
import { Tabs, usePathname } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, View, useColorScheme } from 'react-native'

import { getGiftCards } from '@/api'
import { getLoyaltyPoints } from '@/api/loyalty-point'
import { QUERYKEY, TAB_ROUTES, tabsScreenOptions } from '@/constants'
import { colors as palette } from '@/constants'
import { STATIC_BOTTOM_INSET } from '@/constants/status-bar'
import { useGlassEnabled } from '@/hooks/use-glass'
import { getThemeColor, hexToRgba } from '@/lib/utils'
import { useAuthStore, useUserStore } from '@/stores'
import { useQueryClient } from '@tanstack/react-query'

import { AnimatedTabBar } from './animated-tab-bar'
import { shouldHideCartButton } from './cart-button-visibility'
import { FloatingCartButton } from './floating-cart-button'

const BAR_HEIGHT = 64
const BAR_PADDING = 8
const FADE_HEIGHT = 120

/**
 * Khoảng hở giữa thanh tab và vùng cử chỉ của hệ thống.
 *
 * iPhone có home indicator: safe area (~34) đã đủ thoáng, còn cộng thêm nữa
 * thì thanh đội lên cao hơn hẳn Android (~24). Gap âm cho phép viên lấn vào
 * vùng safe area — home indicator do hệ thống vẽ đè lên nên không bị che.
 * iPhone SE (inset = 0) và Android vẫn cần gap dương.
 */
const VISUAL_GAP = Platform.OS === 'ios' && STATIC_BOTTOM_INSET > 0 ? -8 : 10

export function CustomTabsNavigator() {
  const { t } = useTranslation('tabs')
  const pathname = usePathname()
  const isDark = useColorScheme() === 'dark'
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const colors = useMemo(() => getThemeColor(isDark), [isDark])
  const glass = useGlassEnabled()

  const tabColors = useMemo(
    () => ({
      primary: colors.primary,
      // Trên nền kính, xám nhạt mặc định chìm vào nội dung phía sau nên tab
      // chưa chọn khó đọc. Đổi sang mực đậm; nền đặc vẫn giữ xám như cũ.
      mutedForeground: glass
        ? isDark
          ? palette.gray[200]
          : palette.gray[800]
        : colors.mutedForeground,
      background: colors.background,
      card: colors.card,
    }),
    [
      colors.primary,
      colors.mutedForeground,
      colors.background,
      colors.card,
      glass,
      isDark,
    ],
  )

  const gradientColors = useMemo(
    () => [
      // KHÔNG dùng 'transparent': trong RN nó là rgba(0,0,0,0) — tức ĐEN trong
      // suốt. Gradient nội suy cả kênh RGB nên nó chạy đen → màu nền, tạo ra
      // dải xám mờ ngang phía trên nav bar. Dùng chính màu nền với alpha 0 để
      // chỉ alpha thay đổi, RGB giữ nguyên → fade sạch, không ám xám.
      hexToRgba(colors.background, 0),
      hexToRgba(colors.background, 0.15),
      hexToRgba(colors.background, 0.55),
      colors.background,
    ],
    [colors.background],
  )

  const tabRoutes = useMemo(
    () => ({
      home: TAB_ROUTES.HOME,
      menu: TAB_ROUTES.MENU,
      giftCard: TAB_ROUTES.GIFT_CARD,
      profile: TAB_ROUTES.PROFILE,
    }),
    [],
  )

  // Exhaustive match — không dùng fallback `isHomeActive = !others`.
  // usePathname() đã strip group segment nên so khớp với '/home', không phải
  // '/(tabs)/home' (xem chú thích ở constants/navigation.config.ts).
  // activeIndex = -1 khi không khớp tab nào → indicator giữ nguyên vị trí cũ.
  const tabState = useMemo(() => {
    const p = pathname ?? ''
    return {
      isHomeActive: p === '/' || p === '/home' || p.startsWith('/home/'),
      isMenuActive: p === '/menu' || p.startsWith('/menu/'),
      isGiftCardActive: p === '/gift-card' || p.startsWith('/gift-card/'),
      isProfileActive: p === '/profile' || p.startsWith('/profile/'),
    }
  }, [pathname])

  const onPressInTabSwitch = useCallback(
    (href: string) => {
      // Menu press-in prefetch removed: Menu tab now fetches per-catalog via
      // `useQueries` (queryKey ['specific-menu', { ...request, catalog: slug }]).
      // No catalog list is available here to build a matching key, so a
      // single-key prefetch would just populate a cache entry the Menu
      // screen never reads.
      if (href?.includes('/gift-card') && isAuthenticated) {
        const giftCardKey = [QUERYKEY.giftCards, undefined]
        if (!queryClient.getQueryData(giftCardKey)) {
          queryClient
            .prefetchQuery({
              queryKey: giftCardKey,
              queryFn: () => getGiftCards(),
            })
            .catch(() => {})
        }
      }
      if (href?.includes('/profile') && userSlug) {
        const loyaltyKey = [QUERYKEY.loyaltyPoints, 'total', { slug: userSlug }]
        if (!queryClient.getQueryData(loyaltyKey)) {
          queryClient
            .prefetchQuery({
              queryKey: loyaltyKey,
              queryFn: async () => {
                const res = await getLoyaltyPoints(userSlug)
                return res.result
              },
            })
            .catch(() => {})
        }
      }
    },
    [isAuthenticated, userSlug, queryClient],
  )

  // Các màn từng cần thanh tab trượt ra (chi tiết món, thanh toán, sửa đơn,
  // đăng nhập) giờ nằm ở stack gốc, nơi layout này không hiện — nên chỉ cần
  // ẩn tĩnh, không cần animation trượt như bản trước. Luật ẩn dùng chung với
  // nút giỏ hàng để thanh và nút luôn ẩn/hiện cùng nhau.
  const hidden = shouldHideCartButton(pathname, isAuthenticated)

  // STATIC_BOTTOM_INSET tính 1 lần lúc khởi động (không hook, không re-render
  // giữa transition) — xem constants/status-bar.ts.
  const bottomGap = STATIC_BOTTOM_INSET + VISUAL_GAP

  return (
    <View style={{ flex: 1 }}>
      {!hidden && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
          pointerEvents="box-none"
        >
          {/* Gradient chỉ để nội dung cuộn dưới thanh tab đỡ chói. Máy có
              Liquid Glass thì bỏ, vì kính tự lo phần nền — và có nền mờ phía
              sau thì kính gần như không thấy gì để khúc xạ. */}
          {glass ? null : (
            <View
              style={{
                height: FADE_HEIGHT + BAR_HEIGHT + BAR_PADDING + bottomGap,
                pointerEvents: 'none',
              }}
            >
              <LinearGradient
                colors={
                  gradientColors as unknown as [string, string, ...string[]]
                }
                locations={[0, 0.3, 0.65, 1]}
                style={{ flex: 1 }}
              />
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingBottom: bottomGap,
              paddingHorizontal: 16,
              paddingTop: BAR_PADDING,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <AnimatedTabBar
              t={t}
              colors={tabColors}
              tabState={tabState}
              tabRoutes={tabRoutes}
              onPressInTabSwitch={onPressInTabSwitch}
            />
            <FloatingCartButton primaryColor={colors.primary} />
          </View>
        </View>
      )}

      {/* detachInactiveScreens=false — trade RAM ~100MB để fix stuck bug với
          nested CustomStack trong profile tab. Rapid tab switch gây detach queue
          race trong react-native-screens (expo/expo#35116): sau ~3 lần switch,
          profile's inner stack view stuck visible dù outer tab đã inactive.
          Nested stack + panGesture + BottomSheetModal làm profile tab dễ trigger
          bug này nhất (menu có nested stack nhưng không có gesture layer). */}
      <Tabs
        detachInactiveScreens={false}
        screenOptions={{
          ...tabsScreenOptions,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          // Thanh tab mặc định của @react-navigation bị thu về 0 và trong
          // suốt — AnimatedTabBar ở trên mới là thanh người dùng thấy.
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            height: 0,
            paddingBottom: 0,
            paddingTop: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: { display: 'none' },
          tabBarIconStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      >
        <Tabs.Screen name="home" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="menu" options={{ title: t('tabs.menu') }} />
        <Tabs.Screen
          name="cart"
          options={{ title: t('tabs.cart'), lazy: false }}
        />
        <Tabs.Screen name="gift-card" options={{ title: t('tabs.giftCard') }} />
        <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </Tabs>
    </View>
  )
}
