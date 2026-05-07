/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - Shows toast with title + body
 * - Plays notification sound (volume 0.5)
 */
import { Audio, type AVPlaybackSource } from 'expo-av'
import { useEffect } from 'react'
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging'

import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToast } from '@/utils'

const SOUND_VOLUME = 0.5

// Preloaded sound instance — reuse across notifications, avoid re-loading file
let cachedSound: Audio.Sound | null = null

async function playNotificationSound(): Promise<void> {
  try {
    if (!cachedSound) {
      const { sound } = await Audio.Sound.createAsync(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@/assets/sound/notification.mp3') as AVPlaybackSource,
      )
      cachedSound = sound
    }
    await cachedSound.setPositionAsync(0)
    await cachedSound.setVolumeAsync(SOUND_VOLUME)
    await cachedSound.playAsync()
  } catch {
    // Unload native audio resource before clearing reference to prevent
    // orphaned buffers in the native Audio engine
    if (cachedSound) {
      await cachedSound.unloadAsync().catch(() => {})
    }
    cachedSound = null
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

export function useNotificationListener(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) showToast(body, title)

      playNotificationSound().catch(() => {})
    })

    return unsubscribe
  }, [enabled])
}
