import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { X } from 'lucide-react-native'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'

import { Images } from '@/assets/images'
import { useUserStore } from '@/stores'

// Module-level flags prevent multiple instances (both tabs mounted) from
// showing two modals, and persist dismissal for the session.
let _dismissed = false
let _shown = false

export const DobNudgeBanner = memo(function DobNudgeBanner() {
  const userInfo = useUserStore((s) => s.userInfo)
  const router = useRouter()
  const { t } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'

  const [visible, setVisible] = useState(() => {
    if (_dismissed || _shown || !userInfo || userInfo.dob) return false
    _shown = true
    return true
  })

  const handleDismiss = useCallback(() => {
    _dismissed = true
    setVisible(false)
  }, [])

  const handleCTA = useCallback(() => {
    handleDismiss()
    router.push('/(tabs)/profile/edit')
  }, [handleDismiss, router])

  if (!userInfo || userInfo.dob) return null

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      {/* Backdrop — trong suốt một nửa, tap ngoài để đóng */}
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        {/* Card — stopPropagation để tap trong card không đóng modal */}
        <Pressable
          style={[
            styles.card,
            { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' },
          ]}
          onPress={() => {}}
        >
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={12}
            style={styles.closeBtn}
          >
            <X size={18} color={isDark ? '#6b7280' : '#9ca3af'} />
          </TouchableOpacity>

          <Image
            source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
            style={styles.logo}
            contentFit="contain"
          />

          <Text
            style={[styles.title, { color: isDark ? '#ffffff' : '#111827' }]}
          >
            {t('profile.dobNudge.title')}
          </Text>
          <Text
            style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}
          >
            {t('profile.dobNudge.subtitle')}
          </Text>

          <TouchableOpacity
            onPress={handleCTA}
            activeOpacity={0.8}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaText}>{t('profile.dobNudge.cta')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
})

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 4,
  },
  title: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'BeVietnamPro_600SemiBold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaBtn: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 11,
    borderRadius: 100,
    backgroundColor: '#f59e0b',
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#ffffff',
  },
})
