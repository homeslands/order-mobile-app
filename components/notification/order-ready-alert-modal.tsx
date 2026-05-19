import { Audio, type AVPlaybackSource } from 'expo-av'
import { BellRing } from 'lucide-react-native'
import { memo, useEffect, useRef } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  useColorScheme,
} from 'react-native'

import { colors } from '@/constants'

interface Props {
  isVisible: boolean
  title: string
  body: string
  onDismiss: () => void
}

const VIBRATION_PATTERN = [0, 1000, 500, 1000, 500, 1000, 500, 1000]
const AUTO_DISMISS_MS = 60_000

export const OrderReadyAlertModal = memo(function OrderReadyAlertModal({
  isVisible,
  title,
  body,
  onDismiss,
}: Props) {
  const isDark = useColorScheme() === 'dark'
  const soundRef = useRef<Audio.Sound | null>(null)
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!isVisible) return

    Vibration.vibrate(VIBRATION_PATTERN, true)

    let mounted = true
    Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/assets/sound/order_ready.mp3') as AVPlaybackSource,
      { isLooping: true, volume: 1.0 },
    )
      .then(({ sound }) => {
        if (!mounted) {
          void sound.unloadAsync()
          return
        }
        soundRef.current = sound
        void sound.playAsync()
      })
      .catch(() => {})

    const timer = setTimeout(() => {
      onDismissRef.current()
    }, AUTO_DISMISS_MS)

    return () => {
      mounted = false
      clearTimeout(timer)
      Vibration.cancel()
      const s = soundRef.current
      soundRef.current = null
      if (s) {
        void s.stopAsync().catch(() => {})
        void s.unloadAsync().catch(() => {})
      }
    }
  }, [isVisible])

  if (!isVisible) return null

  const overlayBg = isDark ? 'rgba(0,0,0,0.93)' : 'rgba(15,15,15,0.88)'

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[s.overlay, { backgroundColor: overlayBg }]}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <BellRing size={48} color="#F7A737" strokeWidth={1.5} />
          </View>
          <Text style={[s.title, { color: colors.white.light }]}>{title}</Text>
          {!!body && (
            <Text style={[s.body, { color: colors.gray[300] }]}>{body}</Text>
          )}
        </View>

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Đã lấy đơn"
          style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
        >
          <Text style={s.btnText}>Đã lấy đơn</Text>
        </Pressable>
      </View>
    </Modal>
  )
})

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(247,167,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'BeVietnamPro_600SemiBold',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: '#F7A737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: colors.white.light,
  },
})
