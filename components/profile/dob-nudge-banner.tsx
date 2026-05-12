import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
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
} from 'react-native'

import { Images } from '@/assets/images'
import { useUserStore } from '@/stores'

// Module-level flags: prevent double modal when tabs co-mount, persist dismissal for session
let _dismissed = false
let _shown = false

const LOGO_SIZE = 80
const LOGO_OVERFLOW = LOGO_SIZE / 2

export const DobNudgeBanner = memo(function DobNudgeBanner() {
  const userInfo = useUserStore((s) => s.userInfo)
  const router = useRouter()
  const { t } = useTranslation('profile')

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
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <View style={styles.wrapper}>
          {/* Logo circle nổi lên trên card */}
          <View style={styles.logoCircle}>
            <Image
              source={Images.Brand.Logo}
              style={styles.logo}
              contentFit="contain"
            />
          </View>

          {/* Card — tap bên trong không đóng modal */}
          <Pressable style={styles.cardPressable} onPress={() => {}}>
            <LinearGradient
              colors={['#fbbf24', '#f59e0b', '#b45309']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <TouchableOpacity
                onPress={handleDismiss}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <X size={18} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>

              <Text style={styles.title}>
                {t('profile.dobNudge.title')}
              </Text>
              <Text style={styles.subtitle}>
                {t('profile.dobNudge.subtitle')}
              </Text>

              <TouchableOpacity
                onPress={handleCTA}
                activeOpacity={0.85}
                style={styles.ctaBtn}
              >
                <Text style={styles.ctaText}>
                  {t('profile.dobNudge.cta')}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
})

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -LOGO_OVERFLOW,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  logo: {
    width: 52,
    height: 52,
  },
  cardPressable: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  card: {
    paddingTop: LOGO_OVERFLOW + 20,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: LOGO_OVERFLOW + 10,
    right: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'BeVietnamPro_700Bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'BeVietnamPro_400Regular',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaBtn: {
    marginTop: 20,
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: '#ffffff',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#b45309',
  },
})
