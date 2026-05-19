/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - For ORDER_NEEDS_READY_TO_GET: calls onOrderReady (full-screen alert) instead
 *   of regular toast + sound
 * - For all other codes: shows toast + plays notification.mp3 via shared module
 *
 * Sound lifecycle is managed by lib/notification-sound.ts (preloaded at app
 * startup, single in-flight playback counter, race-safe dispose). We do NOT
 * unload the cached sound on effect cleanup — it is process-scoped.
 */
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { NotificationMessageCode } from '@/constants/notification.constant'
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

export function useNotificationListener(
  enabled = true,
  onOrderReady?: (title: string, body: string) => void,
) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      // eslint-disable-next-line no-console
      console.log(
        '[FCM] foreground message:',
        JSON.stringify(remoteMessage, null, 2),
      )

      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      // data.message is inside the stringified data.payload — parse it first
      let parsedPayload: Record<string, string> = {}
      try {
        parsedPayload = JSON.parse(
          (remoteMessage.data?.payload as string | undefined) ?? '{}',
        ) as Record<string, string>
      } catch {
        /* ignore invalid JSON */
      }
      const code = parsedPayload.message ?? remoteMessage.data?.message

      if (code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET) {
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
      // Intentionally NOT disposing the cached sound — it is process-scoped
      // (managed by lib/notification-sound.ts) and benefits the next user.
    }
  }, [enabled, onOrderReady])
}
