import { BlurView } from 'expo-blur'
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
  useColorScheme,
} from 'react-native'

import { Images } from '@/assets/images'
import { useUserStore } from '@/stores'

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
      {/* Backdrop blur toàn màn */}
      <BlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurBackdrop}
      >
        <Pressable style={styles.pressableBackdrop} onPress={handleDismiss}>
          {/* Card blur riêng — intensity cao hơn để nổi lên */}
          <Pressable onPress={() => {}}>
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'light'}
              style={styles.card}
            >
              <TouchableOpacity
                onPress={handleDismiss}
                hitSlop={16}
                style={styles.closeBtn}
              >
                <X size={20} color={isDark ? '#d1d5db' : '#6b7280'} />
              </TouchableOpacity>

              <Image
                source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
                style={styles.logo}
                contentFit="contain"
              />

              <Text
                style={[
                  styles.description,
                  { color: isDark ? '#e5e7eb' : '#374151' },
                ]}
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
            </BlurView>
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  )
})

const styles = StyleSheet.create({
  blurBackdrop: {
    flex: 1,
  },
  pressableBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'center',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    padding: 4,
  },
  logo: {
    width: 120,
    height: 56,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  ctaBtn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: '#f59e0b',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#ffffff',
  },
})
