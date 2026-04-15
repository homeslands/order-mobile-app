import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { memo, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Images } from '@/assets/images'
import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'

const { width: W } = Dimensions.get('window')
const SLIDE_COUNT = 3
const LAST = SLIDE_COUNT - 1
const BAR_GAP = 6
const BAR_W = (W - 28 * 2 - BAR_GAP * (SLIDE_COUNT - 1)) / SLIDE_COUNT

// Heights of each CTA zone (used to animate text bottom position)
const BTN_H = 54
const BTN_GAP = 12
const GUEST_H = 28      // paddingVertical 6 * 2 + fontSize 16
const TERMS_H = 32      // 2 lines of 12px text
const NEXT_ZONE_H = BTN_H
const LAST_ZONE_H =
  BTN_H + BTN_GAP + BTN_H + BTN_GAP + GUEST_H + BTN_GAP + TERMS_H
const TEXT_GAP = 24

// ─── Data ─────────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'slide0',
    image: Images.News.Article1_1,
    contentPosition: { left: '75%', top: '50%' },
  },
  {
    key: 'slide1',
    image: Images.News.Article2_2,
    contentPosition: { left: '80%', top: '50%' },
  },
  {
    key: 'slide2',
    image: Images.News.Article3_2,
    contentPosition: { left: '50%', top: '50%' },
  },
] as const

// ─── ProgressBar ──────────────────────────────────────────────────────────────

const ProgressBar = memo(function ProgressBar({
  index,
  scrollX,
  activeColor,
}: {
  index: number
  scrollX: SharedValue<number>
  activeColor: string
}) {
  const fillStyle = useAnimatedStyle(() => {
    const fill = interpolate(scrollX.value / W, [index - 1, index], [0, 1], 'clamp')
    return { width: `${fill * 100}%` as `${number}%` }
  })
  return (
    <View style={[s.barTrack, { width: BAR_W }]}>
      <Animated.View style={[s.barFill, { backgroundColor: activeColor }, fillStyle]} />
    </View>
  )
})

// ─── SlideImage ───────────────────────────────────────────────────────────────

const SlideImage = memo(function SlideImage({
  item,
}: {
  item: (typeof SLIDES)[number]
}) {
  return (
    <View style={s.slideWrap}>
      <Image
        source={item.image}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={item.contentPosition}
      />
    </View>
  )
})

// ─── SlideText ────────────────────────────────────────────────────────────────

const SlideText = memo(function SlideText({
  index,
  scrollX,
  title,
  desc,
}: {
  index: number
  scrollX: SharedValue<number>
  title: string
  desc: string
}) {
  const animStyle = useAnimatedStyle(() => {
    const progress = scrollX.value / W - index
    return {
      opacity: interpolate(Math.abs(progress), [0, 0.35], [1, 0], 'clamp'),
      transform: [
        {
          translateY: interpolate(progress, [-0.5, 0, 0.5], [10, 0, -10], 'clamp'),
        },
      ],
    }
  })
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animStyle]} pointerEvents="none">
      <Text style={s.title}>{title}</Text>
      <Text style={s.desc}>{desc}</Text>
    </Animated.View>
  )
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding')
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const primary = isDark ? colors.primary.dark : colors.primary.light

  const [currentIndex, setCurrentIndex] = useState(0)
  const flatListRef = useRef<Animated.FlatList<(typeof SLIDES)[number]>>(null)
  const scrollX = useSharedValue(0)
  const isLast = currentIndex === LAST

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
  })

  const onMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / W))
    },
    [],
  )

  const markSeen = useCallback(
    () => AsyncStorage.setItem('hasSeenOnboarding', 'true'),
    [],
  )

  const handleNext = useCallback(() => {
    flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
  }, [currentIndex])

  const handleRegister = useCallback(async () => {
    await markSeen()
    router.replace('/auth/register')
  }, [router, markSeen])

  const handleLogin = useCallback(async () => {
    await markSeen()
    router.replace('/auth/login')
  }, [router, markSeen])

  const handleGuest = useCallback(async () => {
    await markSeen()
    router.replace('/(tabs)/home')
  }, [router, markSeen])

  // ── UI-thread animations ───────────────────────────────────────────────────

  const nextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value / W, [LAST - 1, LAST], [1, 0], 'clamp'),
  }))

  const lastStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value / W, [LAST - 1, LAST], [0, 1], 'clamp'),
  }))

  // Text bottom animates: low on slides 0-1, higher on slide 2
  const footerBase = insets.bottom + 28
  const textBottomMin = footerBase + NEXT_ZONE_H + TEXT_GAP
  const textBottomMax = footerBase + LAST_ZONE_H + TEXT_GAP

  const textBoxStyle = useAnimatedStyle(() => ({
    bottom: interpolate(
      scrollX.value / W,
      [LAST - 1, LAST],
      [textBottomMin, textBottomMax],
      'clamp',
    ),
  }))

  return (
    <View style={s.root}>
      {/* 1. Full-screen images */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <SlideImage item={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        bounces={false}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Full gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.90)', 'rgba(0,0,0,0.96)']}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 3. Header: progress bars */}
      <View style={[s.header, { paddingTop: STATIC_TOP_INSET + 12 }]}>
        {SLIDES.map((_, i) => (
          <ProgressBar key={i} index={i} scrollX={scrollX} activeColor={primary} />
        ))}
      </View>

      {/* 4. Text — absolute, bottom animates up/down per slide */}
      <Animated.View
        style={[s.textBox, textBoxStyle]}
        pointerEvents="none"
      >
        {SLIDES.map((slide, i) => (
          <SlideText
            key={slide.key}
            index={i}
            scrollX={scrollX}
            title={t(`${slide.key}Title`)}
            desc={t(`${slide.key}Desc`)}
          />
        ))}
      </Animated.View>

      {/* 5. Buttons — always pinned to footer */}

      {/* Next button (slides 0-1) */}
      <Animated.View
        style={[s.footerBtn, { bottom: footerBase }, nextStyle]}
        pointerEvents={isLast ? 'none' : 'auto'}
      >
        <Pressable
          onPress={handleNext}
          style={[s.btnPrimary, { backgroundColor: primary }]}
        >
          <Text style={s.btnPrimaryLabel}>{t('next')}</Text>
        </Pressable>
      </Animated.View>

      {/* Slide 3 actions */}
      <Animated.View
        style={[s.footerBtn, { bottom: footerBase, gap: BTN_GAP }, lastStyle]}
        pointerEvents={isLast ? 'auto' : 'none'}
      >
        <Pressable
          onPress={handleRegister}
          style={[s.btnPrimary, { backgroundColor: primary }]}
        >
          <Text style={s.btnPrimaryLabel}>{t('register')}</Text>
        </Pressable>

        <Pressable onPress={handleLogin} style={s.btnOutline}>
          <Text style={s.btnOutlineLabel}>{t('login')}</Text>
        </Pressable>

        <Pressable onPress={handleGuest} hitSlop={8}>
          <Text style={s.guestLabel}>{t('guest')}</Text>
        </Pressable>

        <View style={s.termsRow}>
          <Text style={s.termsText}>{t('termsUsing')} </Text>
          <Pressable
            onPress={() => Linking.openURL('https://trendcoffee.net/policy')}
            hitSlop={4}
          >
            <Text style={[s.termsLink, { color: primary }]}>{t('termsPolicy')}</Text>
          </Pressable>
          <Text style={s.termsText}>{t('termsAnd')}</Text>
          <Pressable
            onPress={() => Linking.openURL('https://trendcoffee.net/security')}
            hitSlop={4}
          >
            <Text style={[s.termsLink, { color: primary }]}>{t('termsPrivacy')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  slideWrap: { width: W, flex: 1 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 28,
    gap: BAR_GAP,
    zIndex: 10,
  },
  barTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  barFill: {
    height: '100%',
    borderRadius: 1.5,
  },

  // Text block — absolute, bottom is animated
  textBox: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 120,
    justifyContent: 'flex-end',
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  desc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
    marginTop: 8,
  },

  // Footer buttons — always absolute bottom
  footerBtn: {
    position: 'absolute',
    left: 28,
    right: 28,
  },

  btnPrimary: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  btnOutline: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  guestLabel: {
    textAlign: 'center',
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    paddingVertical: 6,
  },
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  termsLink: { fontSize: 12, fontWeight: '600' },
})
