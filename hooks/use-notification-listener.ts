/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - Shows toast + plays notification.mp3 (1s) for all message codes including
 *   ORDER_NEEDS_READY_TO_GET — no special alarm for customers
 *
 * Sound lifecycle managed by lib/notification-sound.ts (preloaded at startup).
 */
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { playNotificationSound } from '@/lib/notification-sound'
import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToastInternal } from '@/providers/toast-provider'

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
      if (body) showToastInternal(title, body, 'info')

      playNotificationSound().catch(() => {})
    })

    return () => {
      unsubscribe()
      // Intentionally NOT disposing the cached sound — process-scoped,
      // managed by lib/notification-sound.ts.
    }
  }, [enabled])
}
