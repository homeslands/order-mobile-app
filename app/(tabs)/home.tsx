/** Tab Home. */
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  Pressable,
  Platform,
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
 * Banner tràn sát mép trên cùng, chạy cả dưới thanh trạng thái như ZaloPay —
 * chiều cao này tính cả vùng thanh trạng thái. Full bề ngang vì SwiperBanner
 * khoá slide = SCREEN_W và phân trang theo contentOffset.x / SCREEN_W.
 */
const BANNER_H = Math.round(SCREEN_W * 0.5)
/** Scrim thanh trạng thái hiện dần trong đoạn cuộn cuối cùng trước khi banner khuất. */
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
        // Android vẽ vòng xoay từ mép trên — đẩy xuống khỏi thanh trạng thái.
        progressViewOffset={Platform.OS === 'android' ? STATIC_TOP_INSET : 0}
      />
    ),
    [refreshing, handleRefresh, primaryColor],
  )

  // Nền trang trắng như ZaloPay (thay cho xám nhạt mặc định của tab).
  const pageBg = isDark ? colors.background.dark : colors.card.light
  const foreground = isDark ? colors.foreground.dark : colors.foreground.light

  // Không còn header cố định: banner chạy dưới thanh trạng thái. Khi cuộn qua
  // banner, nội dung sẽ đè lên giờ/pin — nên một lớp nền cao bằng thanh trạng
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
        {/* 1. Banner khuyến mãi — tràn sát mép, chạy dưới thanh trạng thái */}
        <View style={{ height: BANNER_H }}>
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
              <Text style={[s.sectionTitle, { color: foreground }]}>
                {t('exploreMenu')}
              </Text>
              <Pressable onPress={goMenu}>
                <Text style={[s.sectionLink, { color: primaryColor }]}>
                  {t('viewMenu')}
                </Text>
              </Pressable>
            </View>
            <HighlightMenuCarousel primaryColor={primaryColor} />
          </Animated.View>
        )}
      </Animated.ScrollView>

      <Animated.View
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
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '500',
  },
})
