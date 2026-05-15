/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - Shows toast with title + body
 * - Plays notification sound (volume 0.5)
 *
 * Cleanup:
 * - Single in-flight loadPromise prevents 2× createAsync when notifications
 *   arrive in parallel (otherwise the first Sound instance leaks).
 * - disposeSound() is called in the effect cleanup so the cached Audio.Sound
 *   does not survive logout / unmount.
 */
import { Audio, type AVPlaybackSource } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { NotificationMessageCode } from '@/constants/notification.constant'
import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToastInternal } from '@/providers/toast-provider'

const SOUND_VOLUME = 0.5

// Preloaded sound instance — reuse across notifications, avoid re-loading file
let cachedSound: Audio.Sound | null = null
let loadPromise: Promise<Audio.Sound> | null = null

async function getSound(): Promise<Audio.Sound> {
  if (cachedSound) return cachedSound
  if (!loadPromise) {
    loadPromise = Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/assets/sound/notification.mp3') as AVPlaybackSource,
    )
      .then(({ sound }) => {
        cachedSound = sound
        return sound
      })
      .finally(() => {
        loadPromise = null
      })
  }
  return loadPromise
}

async function disposeSound(): Promise<void> {
  const s = cachedSound
  cachedSound = null
  if (s) {
    await s.unloadAsync().catch(() => {})
  }
}

async function playNotificationSound(): Promise<void> {
  try {
    const sound = await getSound()
    await sound.setPositionAsync(0)
    await sound.setVolumeAsync(SOUND_VOLUME)
    await sound.playAsync()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound playback failed:', e)
    // Unload to keep the native Audio engine clean before we lose the ref
    await disposeSound()
  }
}

async function playNotificationSoundTwice(): Promise<void> {
  await playNotificationSound()
  await new Promise<void>((r) => setTimeout(r, 1500))
  await playNotificationSound()
}

async function playOrderReadyHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await new Promise<void>((r) => setTimeout(r, 400))
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await new Promise<void>((r) => setTimeout(r, 400))
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  } catch {
    // Haptics unavailable on this device — silent fail
  }
}

function getMessageCode(payload: NotificationPayload): string {
  const data = payload.data ?? {}
  let parsed: Record<string, string> = {}
  if (data.payload && typeof data.payload === 'string') {
    try {
      parsed = JSON.parse(data.payload) as Record<string, string>
    } catch {
      // ignore
    }
  }
  const merged = { ...data, ...parsed }
  return merged.message || data.message || ''
}

function firebaseToPayload(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): NotificationPayload {
  const data = (remoteMessage.data ?? {}) as Record<string, string>
  return {
    notification: {
      title: remoteMessage.notification?.title ?? undefined,
      body: remoteMessage.notification?.body ?? undefined,
    },
    data,
    messageId: remoteMessage.messageId ?? undefined,
  }
}

export function useNotificationListener(
  enabled = true,
  onOrderReady?: (payload: NotificationPayload) => void,
) {
  const onOrderReadyRef = useRef(onOrderReady)
  useEffect(() => {
    onOrderReadyRef.current = onOrderReady
  })

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const messageCode = getMessageCode(payload)

      if (messageCode === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET) {
        // High-priority alert: haptic × 3 + sound × 2 + modal (no toast)
        playOrderReadyHaptic().catch(() => {})
        playNotificationSoundTwice().catch(() => {})
        onOrderReadyRef.current?.(payload)
      } else {
        const title = payload.notification?.title || 'Thông báo'
        const body = payload.notification?.body || ''
        if (body) showToastInternal(title, body, 'info')
        playNotificationSound().catch(() => {})
      }
    })

    return () => {
      unsubscribe()
      void disposeSound()
    }
  }, [enabled])
}
