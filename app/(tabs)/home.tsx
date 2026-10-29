/** Tab Home. */
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

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
 * Banner trên cùng, tràn đủ bề ngang (SwiperBanner khoá slide = SCREEN_W và
 * phân trang theo contentOffset.x / SCREEN_W), tỉ lệ 2:1 như ảnh admin vẽ.
 */
const BANNER_H = Math.round(SCREEN_W * 0.5)

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
      />
    ),
    [refreshing, handleRefresh, primaryColor],
  )

  // Nền trang xám của app, thẻ trắng nổi trên đó — như mọi tab khác.
  const pageBg = isDark ? colors.background.dark : colors.background.light
  const foreground = isDark ? colors.foreground.dark : colors.foreground.light

  return (
    <TabScreenLayout backgroundColor={pageBg}>
      {/* Thanh trạng thái có nền riêng, nằm NGOÀI ScrollView. Ảnh banner admin
          vẽ có chữ ngay mép trên — để nó chạy dưới thanh trạng thái thì giờ
          và pin đè lên chữ. Đứng ngoài ScrollView nên nội dung cuộn cũng không
          bao giờ chạy dưới giờ/pin, và vòng xoay kéo-làm-mới hiện bên dưới. */}
      <View
        testID="home-status-bar"
        style={{ height: STATIC_TOP_INSET, backgroundColor: pageBg }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={refreshControl}
      >
        {/* 1. Banner khuyến mãi */}
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
              <Pressable onPress={goMenu} hitSlop={8}>
                <Text style={[s.sectionLink, { color: primaryColor }]}>
                  {t('viewMore')}
                </Text>
              </Pressable>
            </View>
            <HighlightMenuCarousel primaryColor={primaryColor} />
          </Animated.View>
        )}
      </ScrollView>
    </TabScreenLayout>
  )
}

const s = StyleSheet.create({
  sectionSpacing: {
    marginTop: 24,
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
