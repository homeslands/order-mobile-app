/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to expo-notifications received event (foreground only)
 * - Parses FCM payload → adds to notification store
 * - Shows toast with title + body
 * - Plays notification sound (volume 0.5)
 */
import { Audio, type AVPlaybackSource } from 'expo-av'
import * as Notifications from 'expo-notifications'
import { useEffect, useRef } from 'react'

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

function expoToPayload(
  notification: Notifications.Notification,
): NotificationPayload {
  const content = notification.request.content
  const data = (content.data ?? {}) as Record<string, string>

  return {
    notification: {
      title: content.title ?? undefined,
      body: content.body ?? undefined,
    },
    data,
    messageId: notification.request.identifier,
  }
}

export function useNotificationListener(enabled = true) {
  const listenerRef = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Foreground notification received
    listenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const payload = expoToPayload(notification)

        // Add to store
        useNotificationStore
          .getState()
          .addNotification(payload, { markAsRead: false })

        // Toast
        const title = payload.notification?.title || 'Thông báo'
        const body = payload.notification?.body || ''
        if (body) {
          showToast(body, title)
        }

        // Sound
        playNotificationSound().catch(() => {})
      },
    )

    return () => {
      listenerRef.current?.remove()
      listenerRef.current = null
    }
  }, [enabled])
}
