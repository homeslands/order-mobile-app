/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store (deduped via notification-dedup)
 * - Shows toast + plays notification sound for all message codes
 *
 * Sound lifecycle managed by lib/notification-sound.ts (preloaded at startup).
 */
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { hasProcessed, markProcessed, fcmMessageId } from '@/lib/notification-dedup'
import { playNotificationSound, playOrderReadySound } from '@/lib/notification-sound'
import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToastInternal } from '@/providers/toast-provider'
import { NotificationMessageCode } from '@/constants/notification.constant'

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
      const id = fcmMessageId(remoteMessage)
      if (hasProcessed(id)) return
      markProcessed(id)

      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) showToastInternal(title, body, 'info')

      const isOrderReady = remoteMessage.data?.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET
      if (isOrderReady) {
        playOrderReadySound().catch(() => {})
      } else {
        playNotificationSound().catch(() => {})
      }
    })

    return () => {
      unsubscribe()
      // Intentionally NOT disposing the cached sound — process-scoped,
      // managed by lib/notification-sound.ts.
    }
  }, [enabled])
}
