import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { X } from 'lucide-react-native'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native'

import { Images } from '@/assets/images'
import { useUserStore } from '@/stores'

// Persists dismissal for the session without a store
let _dismissed = false

export const DobNudgeBanner = memo(function DobNudgeBanner() {
  const userInfo = useUserStore((s) => s.userInfo)
  const router = useRouter()
  const { t } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'
  const [dismissed, setDismissed] = useState(_dismissed)

  const handleDismiss = useCallback(() => {
    _dismissed = true
    setDismissed(true)
  }, [])

  if (!userInfo || userInfo.dob || dismissed) return null

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
          shadowColor: isDark ? '#000' : '#00000026',
        },
      ]}
    >
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={12}
        style={styles.closeBtn}
      >
        <X size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Image
          source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
          style={styles.logo}
          contentFit="contain"
        />
        <Text
          style={[styles.title, { color: isDark ? '#ffffff' : '#111827' }]}
          numberOfLines={1}
        >
          {t('profile.dobNudge.title')}
        </Text>
        <Text
          style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}
          numberOfLines={2}
        >
          {t('profile.dobNudge.subtitle')}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile/edit')}
          activeOpacity={0.8}
          style={styles.ctaBtn}
        >
          <Text style={styles.ctaText}>{t('profile.dobNudge.cta')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  logo: {
    width: 56,
    height: 56,
  },
  title: {
    marginTop: 12,
    fontSize: 15,
    fontFamily: 'BeVietnamPro_600SemiBold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  ctaBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: '#f59e0b',
  },
  ctaText: {
    fontSize: 13,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#ffffff',
  },
})
