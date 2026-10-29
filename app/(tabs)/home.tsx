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
  SwiperBanner,
} from '@/components/home'
import {
  TabHeader,
  TabScreenLayout,
  useTabBarBottomPadding,
} from '@/components/layout'
import { Skeleton } from '@/components/ui'
import { NotificationBell } from '@/components/notification/notification-bell'
import { BannerPage, QUERYKEY, colors } from '@/constants'
import { useRunAfterTransition } from '@/hooks'
import { useBanners } from '@/hooks/use-banner'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import type { IBanner } from '@/types'
import { Text } from '@/components/ui/text'

const SCREEN_W = Dimensions.get('window').width

/**
 * Banner nằm dưới lưới chức năng, không còn là hero trên cùng, nên thấp hơn
 * tỉ lệ 2:1 cũ. Giữ full bề ngang vì SwiperBanner khoá slide = SCREEN_W và
 * phân trang theo contentOffset.x / SCREEN_W.
 */
const BANNER_H = Math.round(SCREEN_W * 0.45)

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

  const bellColor = isDark ? colors.foreground.dark : colors.foreground.light

  return (
    <TabScreenLayout>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <TabHeader
        variant="logo"
        rightActions={<NotificationBell color={bellColor} size={24} />}
      />

      {/* ─── Scrollable content ──────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={refreshControl}
      >
        {/* 1–2. Số dư và lưới chức năng — KHÔNG chờ `ready`: đây là lớp điều
            khiển dùng ở quầy, chờ transition xong mới hiện là mất ý nghĩa. */}
        <BalanceCard />
        <HomeActionGrid />

        {/* 3. Banner khuyến mãi */}
        <View style={[s.bannerSpacing, { height: BANNER_H }]}>
          {showBannerSkeleton ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <SwiperBanner bannerData={banners} height={BANNER_H} />
          )}
        </View>

        {/* 4. Sản phẩm nổi bật */}
        {ready && (
          <Animated.View
            style={s.sectionSpacing}
            entering={FadeInDown.duration(350).delay(140)}
          >
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: primaryColor }]}>
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
      </ScrollView>
    </TabScreenLayout>
  )
}

const s = StyleSheet.create({
  bannerSpacing: {
    marginTop: 20,
  },
  sectionSpacing: {
    marginTop: 44,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '500',
  },
})
