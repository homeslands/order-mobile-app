/**
 * useNotificationResponse — handle user tapping a notification (background + cold start).
 *
 * Two parallel paths — both needed because FCM notifications from
 * @react-native-firebase/messaging are NOT visible to expo-notifications on Android:
 *
 * Path A — RNFirebase:
 *   - getInitialNotification()  → cold start
 *   - onNotificationOpenedApp() → background tap
 *
 * Path B — expo-notifications (iOS local / in-app alerts):
 *   - addNotificationResponseReceivedListener → background tap
 *   - getLastNotificationResponseAsync        → cold start, guarded by launch-time check
 *
 * All message codes including ORDER_NEEDS_READY_TO_GET navigate via
 * navigateFromNotification — no special modal path for customers.
 */
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { hasProcessed, markProcessed, fcmMessageId } from '@/lib/notification-dedup'
import { isResponseFromThisSession } from '@/lib/app-launch-time'
import { navigateFromNotification } from '@/lib/notification-navigation'
import { useNotificationStore } from '@/stores/notification.store'

function expoUnifiedId(response: Notifications.NotificationResponse): string {
  const data = response.notification.request.content.data as
    | Record<string, string>
    | undefined
  const dataMsgId = data?.['google.message_id'] ?? data?.['gcm.message_id']
  return dataMsgId ?? response.notification.request.identifier
}

export function useNotificationResponse(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    // ── Path A: RNFirebase ────────────────────────────────────────────────────

    const handleFcmMessage = (
      remoteMessage: FirebaseMessagingTypes.RemoteMessage,
      mode: 'cold-start' | 'background-tap',
    ) => {
      const id = fcmMessageId(remoteMessage)
      if (hasProcessed(id)) return
      markProcessed(id)


      const rawData = remoteMessage.data as Record<string, string> | undefined

      useNotificationStore.getState().addNotification(
        {
          notification: {
            title: remoteMessage.notification?.title ?? undefined,
            body: remoteMessage.notification?.body ?? undefined,
          },
          data: rawData ?? {},
          messageId: id,
        },
        { markAsRead: false },
      )

      navigateFromNotification(rawData, mode)
    }

    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) handleFcmMessage(remoteMessage, 'cold-start')
      })
      .catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[FCM] getInitialNotification failed:', e),
      )

    const unsubOpened = messaging().onNotificationOpenedApp((rm) =>
      handleFcmMessage(rm, 'background-tap'),
    )

    // ── Path B: expo-notifications ───────────────────────────────────────────

    const handleExpoResponse = (
      response: Notifications.NotificationResponse,
      mode: 'cold-start' | 'background-tap',
    ) => {
      const id = expoUnifiedId(response)
      if (hasProcessed(id)) return
      markProcessed(id)

      const content = response.notification.request.content
      const data = content.data as Record<string, string> | undefined

      useNotificationStore.getState().addNotification(
        {
          notification: {
            title: content.title ?? undefined,
            body: content.body ?? undefined,
          },
          data: data ?? {},
          messageId: id,
        },
        { markAsRead: false },
      )

      navigateFromNotification(data, mode)
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => handleExpoResponse(response, 'background-tap'),
    )

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return
        const dateMs = response.notification.date
        if (!isResponseFromThisSession(dateMs)) {
          // eslint-disable-next-line no-console
          console.log(
            '[Notifications] Discarding ghost response from previous session:',
            new Date(dateMs).toISOString(),
          )
          return
        }
        handleExpoResponse(response, 'cold-start')
      })
      .catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[Notifications] getLastNotificationResponseAsync failed:', e),
      )

    return () => {
      unsubOpened()
      subscription.remove()
    }
  }, [enabled])
}
