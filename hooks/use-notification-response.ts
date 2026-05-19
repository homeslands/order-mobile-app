/**
 * useNotificationResponse — handle user tapping a notification (background + cold start).
 *
 * Two parallel paths — both are needed because FCM notifications delivered by
 * @react-native-firebase/messaging are NOT visible to expo-notifications on Android:
 *
 * Path A — RNFirebase (FCM data/notification messages from system tray):
 *   - messaging().getInitialNotification()  → cold start (app killed, opened via tap)
 *   - messaging().onNotificationOpenedApp() → background tap (app in background)
 *
 * Path B — expo-notifications (iOS local notifications, in-app scheduled alerts):
 *   - addNotificationResponseReceivedListener → background tap
 *   - getLastNotificationResponseAsync       → cold start fallback (iOS)
 *
 * Both paths share the same dedup Set and navigate via navigateFromNotification.
 * firebase.getInitialNotification() holds the message until consumed, so calling it
 * after auth rehydrates (~100-300ms) is safe — data is not lost.
 */
import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { navigateFromNotification } from '@/lib/notification-navigation'
import { useNotificationStore } from '@/stores/notification.store'

// Giới hạn số notification ID đã xử lý — tránh Set tăng vô hạn trong session dài.
// 100 ID gần nhất là đủ để dedup; notification cũ hơn 100 lần không thể bị fire lại.
const MAX_PROCESSED_IDS = 100

function trimProcessed(set: Set<string>) {
  if (set.size > MAX_PROCESSED_IDS) {
    const oldest = set.values().next().value
    if (oldest !== undefined) set.delete(oldest)
  }
}

export function useNotificationResponse(enabled = true) {
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return

    // ── Path A: RNFirebase ────────────────────────────────────────────────────

    const handleFcmMessage = (
      remoteMessage: FirebaseMessagingTypes.RemoteMessage,
    ) => {
      const id =
        remoteMessage.messageId ?? String(remoteMessage.sentTime ?? Date.now())
      if (processedRef.current.has(id)) return
      processedRef.current.add(id)
      trimProcessed(processedRef.current)

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

      navigateFromNotification(rawData)
    }

    // Cold start: app was killed and opened by tapping a system notification.
    // Firebase holds this until consumed — safe to call after auth rehydrates.
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) handleFcmMessage(remoteMessage)
      })
      .catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[FCM] getInitialNotification failed:', e),
      )

    // Background tap: app was in background (not killed) and user tapped notification.
    const unsubOpened = messaging().onNotificationOpenedApp(handleFcmMessage)

    // ── Path B: expo-notifications (iOS local / in-app alerts) ───────────────

    const handleExpoResponse = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier
      if (processedRef.current.has(id)) return
      processedRef.current.add(id)
      trimProcessed(processedRef.current)

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

      navigateFromNotification(data)
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleExpoResponse)

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleExpoResponse(response)
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
