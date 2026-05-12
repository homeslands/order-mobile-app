import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { X } from 'lucide-react-native'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { Images } from '@/assets/images'
import { useUserStore } from '@/stores'

let _dismissed = false
let _shown = false

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
        <Pressable style={styles.container} onPress={() => {}}>
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={16}
            style={styles.closeBtn}
          >
            <X size={22} color="#ffffff" />
          </TouchableOpacity>

          <Image
            source={Images.Brand.LogoWhite}
            style={styles.logo}
            contentFit="contain"
          />

          <Text style={styles.description}>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 60,
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_400Regular',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  ctaBtn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#ffffff',
  },
})
