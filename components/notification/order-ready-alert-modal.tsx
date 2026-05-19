import { Audio, type AVPlaybackSource } from 'expo-av'
import LottieView from 'lottie-react-native'
import type { AnimationObject } from 'lottie-react-native'
import { memo, useEffect, useRef } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
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

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const LOTTIE_SOURCE: AnimationObject = require('@/assets/animations/order-ready.json')

export const OrderReadyAlertModal = memo(function OrderReadyAlertModal({
  isVisible,
  title,
  body,
  onDismiss,
}: Props) {
  const soundRef = useRef<Audio.Sound | null>(null)
  const lottieRef = useRef<LottieView>(null)
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!isVisible) return

    Vibration.vibrate(VIBRATION_PATTERN, true)
    const lottie = lottieRef.current
    lottie?.play()

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
      lottie?.reset()
      const s = soundRef.current
      soundRef.current = null
      if (s) {
        void s.stopAsync().catch(() => {})
        void s.unloadAsync().catch(() => {})
      }
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Lottie illustration */}
          <LottieView
            ref={lottieRef}
            source={LOTTIE_SOURCE}
            autoPlay
            loop
            style={s.lottie}
            renderMode="HARDWARE"
            onAnimationFailure={() => {}}
          />

          {/* Text */}
          <View style={s.textBlock}>
            <Text style={s.title}>{title}</Text>
            {!!body && <Text style={s.body}>{body}</Text>}
          </View>

          {/* CTA */}
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Đã lấy đơn"
            style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          >
            <Text style={s.btnText}>Đã lấy đơn</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
})

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.primary.light,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 0,
  },
  lottie: {
    width: 160,
    height: 160,
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontFamily: 'BeVietnamPro_700Bold',
    color: colors.white.light,
    textAlign: 'center',
    lineHeight: 28,
  },
  body: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_400Regular',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.white.light,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'BeVietnamPro_700Bold',
    color: colors.gray[900],
  },
})
