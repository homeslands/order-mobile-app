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
import { ROUTE } from '@/constants'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'

// ─── Shared visual shell ─────────────────────────────────────────────────────

interface NudgePopupProps {
  visible: boolean
  subtitle: string
  ctaLabel: string
  onDismiss: () => void
  onCTA: () => void
}

const NudgePopup = memo(function NudgePopup({
  visible,
  subtitle,
  ctaLabel,
  onDismiss,
  onCTA,
}: NudgePopupProps) {
  const isDark = useColorScheme() === 'dark'

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* Backdrop blur tối để nội dung popup nổi bật */}
      <BlurView intensity={70} tint="dark" style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onDismiss}>
          <Pressable style={[styles.card, { backgroundColor: isDark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.88)' }]} onPress={() => {}}>
            <TouchableOpacity onPress={onDismiss} hitSlop={16} style={styles.closeBtn}>
              <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>

            <Image
              source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
              style={styles.logo}
              contentFit="contain"
            />

            <Text style={[styles.subtitle, { color: isDark ? '#e5e7eb' : '#374151' }]}>
              {subtitle}
            </Text>

            <TouchableOpacity onPress={onCTA} activeOpacity={0.8} style={styles.ctaBtn}>
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  )
})

// ─── Module-level session flags ───────────────────────────────────────────────

let _dobDismissed = false
let _dobShown = false
let _phoneDismissed = false
let _phoneShown = false

// ─── DOB nudge ────────────────────────────────────────────────────────────────

export const DobNudgeBanner = memo(function DobNudgeBanner() {
  const userInfo = useUserStore((s) => s.userInfo)
  const { t } = useTranslation('profile')

  const [visible, setVisible] = useState(() => {
    if (_dobDismissed || _dobShown || !userInfo || userInfo.dob) return false
    _dobShown = true
    return true
  })

  const handleDismiss = useCallback(() => {
    _dobDismissed = true
    setVisible(false)
  }, [])

  const handleCTA = useCallback(() => {
    handleDismiss()
    navigateNative.push(ROUTE.CLIENT_PROFILE_EDIT as never)
  }, [handleDismiss])

  if (!userInfo || userInfo.dob) return null

  return (
    <NudgePopup
      visible={visible}
      subtitle={t('profile.dobNudge.subtitle')}
      ctaLabel={t('profile.dobNudge.cta')}
      onDismiss={handleDismiss}
      onCTA={handleCTA}
    />
  )
})

// ─── Phone verify nudge ───────────────────────────────────────────────────────

export const PhoneVerifyNudgeBanner = memo(function PhoneVerifyNudgeBanner() {
  const userInfo = useUserStore((s) => s.userInfo)
  const { t } = useTranslation('profile')

  const [visible, setVisible] = useState(() => {
    if (_phoneDismissed || _phoneShown || !userInfo || userInfo.isVerifiedPhonenumber) return false
    _phoneShown = true
    return true
  })

  const handleDismiss = useCallback(() => {
    _phoneDismissed = true
    setVisible(false)
  }, [])

  const handleCTA = useCallback(() => {
    handleDismiss()
    navigateNative.push(ROUTE.CLIENT_PROFILE_VERIFY_PHONE_NUMBER as never)
  }, [handleDismiss])

  if (!userInfo || userInfo.isVerifiedPhonenumber) return null

  return (
    <NudgePopup
      visible={visible}
      subtitle={t('profile.phoneVerifyNudge.subtitle')}
      ctaLabel={t('profile.phoneVerifyNudge.cta')}
      onDismiss={handleDismiss}
      onCTA={handleCTA}
    />
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  card: {
    width: '100%',
    borderRadius: 24,
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
  subtitle: {
    fontSize: 14,
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
