/** Tab Home. */
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

import {
  BalanceCard,
  HighlightMenuCarousel,
  HomeActionGrid,
  HomeGreeting,
  SwiperBanner,
} from '@/components/home'
import { TabScreenLayout, useTabBarBottomPadding } from '@/components/layout'
import { Skeleton } from '@/components/ui'
import { BannerPage, QUERYKEY, colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useRunAfterTransition } from '@/hooks'
import { useBanners } from '@/hooks/use-banner'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import type { IBanner } from '@/types'
import { Text } from '@/components/ui/text'

const SCREEN_W = Dimensions.get('window').width

/**
 * Banner tràn lên thanh trạng thái, đủ bề ngang (SwiperBanner khoá slide =
 * SCREEN_W và phân trang theo contentOffset.x / SCREEN_W), khung 16:9 để ảnh
 * hiện đủ. Đo banner thật (2026-10-30): "Món mới", "metro" 1672×941 (16:9);
 * "Matcha", "Đăng ký thành viên" 2048×878 (21:9) — đã thống nhất là admin
 * tải lại theo 16:9. Trong lúc chờ, ảnh dùng contain nên ảnh 21:9 hiện đủ với
 * dải trống trên dưới thay vì bị cắt.
 */
const BANNER_H = Math.round((SCREEN_W * 9) / 16)
/** Scrim thanh trạng thái hiện dần trong đoạn cuộn cuối trước khi banner khuất. */
const SCRIM_FADE = 24

const FALLBACK_BANNER: IBanner = {
  slug: 'fallback',
  createdAt: '',
  title: 'TREND Coffee',
  content: '',
  url: '',
  useButtonUrl: false,
  image: '',
  isActive: true,
  page: BannerPage.HOME,
}

export default function HomeScreen() {
  const { t } = useTranslation('home')
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const bottomPadding = useTabBarBottomPadding()

  const [ready, setReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: bannerResponse,
    isLoading: isBannerLoading,
    refetch: refetchBanners,
  } = useBanners({ page: BannerPage.HOME, isActive: true })

  useRunAfterTransition(() => setReady(true), [])

  const banners: IBanner[] = useMemo(() => {
    const raw = bannerResponse?.result
    return raw && raw.length > 0 ? raw : [FALLBACK_BANNER]
  }, [bannerResponse?.result])
  const showBannerSkeleton = !ready || isBannerLoading

  const queryClient = useQueryClient()
  // Home là màn dạng ví: kéo để làm mới thì khách chờ số dư mới, không chỉ
  // banner. Invalidate theo tiền tố — Home không giữ slug, và tiền tố
  // loyaltyPoints phủ cả key tổng điểm mà không phải dựng lại key đó ở đây.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      refetchBanners(),
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.profile, 'balance'],
      }),
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.loyaltyPoints] }),
    ])
    setRefreshing(false)
  }, [refetchBanners, queryClient])

  const goMenu = useCallback(() => {
    router.push('/(tabs)/menu' as never)
  }, [router])

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        tintColor={primaryColor}
        colors={[primaryColor]}
        // ScrollView bắt đầu từ y=0 dưới giờ/pin: đẩy vòng xoay xuống khỏi
        // thanh trạng thái, trên CẢ hai nền tảng — iOS có hỗ trợ prop này, và
        // offset 0 thì vòng xoay nằm sau tai thỏ / Dynamic Island.
        progressViewOffset={STATIC_TOP_INSET}
      />
    ),
    [refreshing, handleRefresh, primaryColor],
  )

  // Nền trang xám của app, thẻ trắng nổi trên đó — như mọi tab khác.
  const pageBg = isDark ? colors.background.dark : colors.background.light
  const foreground = isDark ? colors.foreground.dark : colors.foreground.light

  // Banner chạy dưới thanh trạng thái nên không có header cố định. Khi cuộn
  // qua banner, nội dung sẽ đè lên giờ/pin — một lớp nền cao bằng thanh trạng
  // thái hiện dần ngay trước khi banner khuất hẳn.
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [BANNER_H - STATIC_TOP_INSET - SCRIM_FADE, BANNER_H - STATIC_TOP_INSET],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }))

  return (
    <TabScreenLayout backgroundColor={pageBg}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={refreshControl}
      >
        {/* 1. Banner khuyến mãi — tràn lên thanh trạng thái */}
        <View
          testID="home-banner"
          style={{ height: BANNER_H, backgroundColor: pageBg }}
        >
          {showBannerSkeleton ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <SwiperBanner bannerData={banners} height={BANNER_H} />
          )}
        </View>

        {/* 2–4. Lời chào, số dư và các nút — KHÔNG chờ `ready`: đây là lớp
            điều khiển dùng ở quầy, chờ transition xong mới hiện là mất ý
            nghĩa. */}
        <HomeGreeting />
        <BalanceCard />
        <HomeActionGrid />

        {/* 5. Sản phẩm nổi bật */}
        {ready && (
          <Animated.View
            style={s.sectionSpacing}
            entering={FadeInDown.duration(350).delay(140)}
          >
            <View style={s.sectionHeader}>
              <Text
                className="font-sans-semibold"
                style={[s.sectionTitle, { color: foreground }]}
              >
                {t('exploreMenu')}
              </Text>
              <Pressable onPress={goMenu} hitSlop={8}>
                <Text
                  className="font-sans-medium"
                  style={[s.sectionLink, { color: primaryColor }]}
                >
                  {t('viewMore')}
                </Text>
              </Pressable>
            </View>
            <HighlightMenuCarousel primaryColor={primaryColor} />
          </Animated.View>
        )}
      </Animated.ScrollView>

      <Animated.View
        testID="home-status-scrim"
        pointerEvents="none"
        style={[
          s.statusScrim,
          { height: STATIC_TOP_INSET, backgroundColor: pageBg },
          scrimStyle,
        ]}
      />
    </TabScreenLayout>
  )
}

const s = StyleSheet.create({
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  // Độ đậm đi qua họ font (font-sans-semibold/-medium), không qua fontWeight:
  // mỗi độ đậm của BeVietnamPro là một họ font riêng.
  sectionTitle: {
    fontSize: 18,
  },
  sectionLink: {
    fontSize: 14,
  },
})
