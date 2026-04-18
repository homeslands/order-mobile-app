import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Play } from 'lucide-react-native'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'

import { colors } from '@/constants'
import { usePrimaryColor } from '@/hooks/use-primary-color'

interface YouTubeVideoSectionProps {
  videoId: string
  title?: string
}

export const YouTubeVideoSection = React.memo(function YouTubeVideoSection({
  videoId,
  title,
}: YouTubeVideoSectionProps) {
  const { t } = useTranslation('home')
  const isDark = useColorScheme() === 'dark'
  const { width: screenWidth } = useWindowDimensions()
  const primaryColor = usePrimaryColor()
  const [imageError, setImageError] = useState(false)

  const cardWidth = screenWidth - 32
  const thumbHeight = Math.round((cardWidth * 9) / 16)

  const thumbnailUrl = imageError
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  const handlePress = () => {
    const appUrl = `vnd.youtube:${videoId}`
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`
    Linking.canOpenURL(appUrl)
      .then((ok) => Linking.openURL(ok ? appUrl : webUrl))
      .catch(() => Linking.openURL(webUrl))
  }

  const cardBg = isDark ? colors.card.dark : colors.card.light
  const mutedFg = isDark
    ? colors.mutedForeground.dark
    : colors.mutedForeground.light
  const borderColor = isDark ? colors.border.dark : colors.border.light

  return (
    <View style={s.wrapper}>
      {/* Title — same style as highlight section */}
      <Text style={[s.title, { color: primaryColor }]}>
        {title ?? t('videoSection.title')}
      </Text>

      {/* Card */}
      <Pressable
        style={({ pressed }) => [
          s.card,
          { backgroundColor: cardBg, borderColor, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={handlePress}
      >
        {/* Thumbnail — bo 4 góc, tách khỏi footer nên không phụ thuộc overflow card */}
        <View style={[s.thumbWrap, { height: thumbHeight }]}>
          <Image
            source={{ uri: thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => setImageError(true)}
            recyclingKey={`yt-thumb-${videoId}`}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            locations={[0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Play button */}
          <View style={s.playBtn}>
            <Play size={24} color="#fff" fill="#fff" />
          </View>
          {/* YouTube badge */}
          <View style={s.ytBadge}>
            <View style={s.ytDot} />
            <Text style={s.ytText}>YouTube</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={[s.tapLabel, { color: mutedFg }]}>
            {t('videoSection.tap')}
          </Text>
          <View style={[s.ctaBtn, { backgroundColor: primaryColor }]}>
            <Text style={s.ctaText}>{t('videoSection.cta')}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  )
})

export default YouTubeVideoSection

const s = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbWrap: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 16,
    overflow: 'hidden',
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ytBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  ytDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF0000',
  },
  ytText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  tapLabel: {
    fontSize: 13,
  },
  ctaBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
})
