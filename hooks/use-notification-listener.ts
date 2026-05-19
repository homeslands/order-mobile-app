/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - For ORDER_NEEDS_READY_TO_GET: calls onOrderReady (full-screen alert) instead
 *   of regular toast + sound
 * - For all other codes: shows toast + plays notification.mp3
 *
 * Cleanup:
 * - Single in-flight loadPromise prevents 2× createAsync when notifications
 *   arrive in parallel (otherwise the first Sound instance leaks).
 * - disposeSound() is called in the effect cleanup so the cached Audio.Sound
 *   does not survive logout / unmount.
 */
import { Audio, type AVPlaybackSource } from 'expo-av'
import { useEffect } from 'react'
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
  onOrderReady?: (title: string, body: string) => void,
) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const code = remoteMessage.data?.message as string | undefined

      if (code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET) {
        // Full-screen modal handles alert — skip regular toast + sound
        const alertTitle =
          remoteMessage.notification?.title ?? 'Đơn của bạn đã sẵn sàng'
        const alertBody = remoteMessage.notification?.body ?? ''
        onOrderReady?.(alertTitle, alertBody)
        return
      }

      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) showToastInternal(title, body, 'info')

      playNotificationSound().catch(() => {})
    })

    return () => {
      unsubscribe()
      void disposeSound()
    }
  }, [enabled, onOrderReady])
}
