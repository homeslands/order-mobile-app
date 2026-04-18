/** Tab Home. */
import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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
  BrandSection,
  HighlightMenuCarousel,
  SwiperBanner,
  YouTubeVideoSection,
} from '@/components/home'
import {
  TabHeader,
  TabScreenLayout,
  useTabBarBottomPadding,
} from '@/components/layout'
import { Skeleton } from '@/components/ui'
import { NotificationBell } from '@/components/notification/notification-bell'
import { BannerPage, colors, youtubeVideoId } from '@/constants'
import { useRunAfterTransition } from '@/hooks'
import { useBanners } from '@/hooks/use-banner'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import type { IBanner } from '@/types'

const SCREEN_W = Dimensions.get('window').width

/** Banner taller hơn 25% để có room dịch chuyển khi parallax. */
const BANNER_EXTRA_RATIO = 0.25

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetchBanners()
    setRefreshing(false)
  }, [refetchBanners])

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

  // ─── Scroll tracking ─────────────────────────────────────────────
  const scrollY = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((e) => {
    'worklet'
    scrollY.value = e.contentOffset.y
  })

  // Fixed banner height — 2:1 aspect ratio
  const BANNER_H = Math.round(SCREEN_W / 2)
  const BANNER_INNER_H = BANNER_H * (1 + BANNER_EXTRA_RATIO)

  /** Parallax: banner dịch xuống chậm hơn scroll → tạo độ sâu */
  const bannerParallaxStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, BANNER_H],
            [0, BANNER_H * BANNER_EXTRA_RATIO],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  const bellColor = isDark ? colors.foreground.dark : colors.foreground.light

  return (
    <TabScreenLayout>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <TabHeader
        variant="logo"
        rightActions={<NotificationBell color={bellColor} size={24} />}
      />

      {/* ─── Scrollable content ──────────────────────────────────────── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={refreshControl}
      >
        {/* 1. Hero Banner với parallax */}
        <View style={{ height: BANNER_H, overflow: 'hidden' }}>
          {showBannerSkeleton ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <Animated.View
              style={[{ height: BANNER_INNER_H }, bannerParallaxStyle]}
            >
              <SwiperBanner bannerData={banners} height={BANNER_INNER_H} />
            </Animated.View>
          )}
        </View>

        {/* 2. Brand info + store carousel */}
        {ready && (
          <Animated.View entering={FadeInDown.duration(350).delay(60)}>
            <BrandSection />
          </Animated.View>
        )}

        {/* 3. Sản phẩm nổi bật */}
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

        {/* 4. YouTube / Member Guide */}
        {ready && youtubeVideoId && (
          <Animated.View
            style={s.sectionSpacing}
            entering={FadeInDown.duration(350).delay(220)}
          >
            <YouTubeVideoSection
              videoId={youtubeVideoId}
              title={t('videoSection.title')}
            />
          </Animated.View>
        )}
      </Animated.ScrollView>
    </TabScreenLayout>
  )
}

const s = StyleSheet.create({
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
