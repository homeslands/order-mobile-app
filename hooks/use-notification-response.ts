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
 *   - getLastNotificationResponseAsync       → cold start fallback (iOS) — guarded
 *     by launch-time check to discard ghost responses from previous sessions.
 *
 * Both paths share a module-level dedup Set keyed by a unified ID derived from
 * FCM message_id when available, falling back to identifier / sentTime.
 *
 * ORDER_READY messages bypass simple navigation: they trigger the full-screen
 * alert modal (same UX as a foreground push), and only navigate when the user
 * dismisses it. This is handled by the caller — see notification-provider.tsx.
 */
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { isResponseFromThisSession } from '@/lib/app-launch-time'
import { navigateFromNotification } from '@/lib/notification-navigation'
import { useNotificationStore } from '@/stores/notification.store'

// Module-level dedup Set — survives hook re-mounts / auth toggles.
const processedIds = new Set<string>()
const MAX_PROCESSED_IDS = 100

function trimProcessed() {
  if (processedIds.size > MAX_PROCESSED_IDS) {
    const oldest = processedIds.values().next().value
    if (oldest !== undefined) processedIds.delete(oldest)
  }
}

function fcmUnifiedId(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): string {
  // RNFirebase exposes messageId; iOS APNS also exposes google.message_id in data.
  const dataMsgId =
    (remoteMessage.data?.['google.message_id'] as string | undefined) ??
    (remoteMessage.data?.['gcm.message_id'] as string | undefined)
  return (
    remoteMessage.messageId ??
    dataMsgId ??
    String(remoteMessage.sentTime ?? Date.now())
  )
}

function expoUnifiedId(response: Notifications.NotificationResponse): string {
  const data = response.notification.request.content.data as
    | Record<string, string>
    | undefined
  const dataMsgId = data?.['google.message_id'] ?? data?.['gcm.message_id']
  return dataMsgId ?? response.notification.request.identifier
}

function parsePayloadMessage(
  data: Record<string, string> | undefined,
): string | undefined {
  if (!data) return undefined
  if (typeof data.message === 'string') return data.message
  const raw = data.payload
  if (typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed.message
  } catch {
    return undefined
  }
}

export function useNotificationResponse(
  enabled = true,
  onOrderReady?: (title: string, body: string) => void,
) {
  useEffect(() => {
    if (!enabled) return

    // ── Path A: RNFirebase ────────────────────────────────────────────────────

    const handleFcmMessage = (
      remoteMessage: FirebaseMessagingTypes.RemoteMessage,
      mode: 'cold-start' | 'background-tap',
    ) => {
      const id = fcmUnifiedId(remoteMessage)
      if (processedIds.has(id)) return
      processedIds.add(id)
      trimProcessed()

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

      const code = parsePayloadMessage(rawData)
      if (
        code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET &&
        onOrderReady
      ) {
        const title =
          remoteMessage.notification?.title ?? 'Đơn của bạn đã sẵn sàng'
        const body = remoteMessage.notification?.body ?? ''
        onOrderReady(title, body)
        return
      }

      navigateFromNotification(rawData, mode)
    }

    // Cold start: app was killed and opened by tapping a system notification.
    // Firebase holds this until consumed — safe to call after auth rehydrates.
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) handleFcmMessage(remoteMessage, 'cold-start')
      })
      .catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[FCM] getInitialNotification failed:', e),
      )

    // Background tap: app was in background (not killed) and user tapped notification.
    const unsubOpened = messaging().onNotificationOpenedApp((rm) =>
      handleFcmMessage(rm, 'background-tap'),
    )

    // ── Path B: expo-notifications (iOS local / in-app alerts) ───────────────

    const handleExpoResponse = (
      response: Notifications.NotificationResponse,
      mode: 'cold-start' | 'background-tap',
    ) => {
      const id = expoUnifiedId(response)
      if (processedIds.has(id)) return
      processedIds.add(id)
      trimProcessed()

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

      const code = parsePayloadMessage(data)
      if (
        code === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET &&
        onOrderReady
      ) {
        onOrderReady(
          content.title ?? 'Đơn của bạn đã sẵn sàng',
          content.body ?? '',
        )
        return
      }

      navigateFromNotification(data, mode)
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => handleExpoResponse(response, 'background-tap'),
    )

    // Cold-start fallback for iOS local notifications. Guard against ghost
    // responses left over from a previous app session — only consume if the
    // notification's delivery date falls within this session's window.
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
        console.warn(
          '[Notifications] getLastNotificationResponseAsync failed:',
          e,
        ),
      )

    return () => {
      unsubOpened()
      subscription.remove()
    }
  }, [enabled, onOrderReady])
}
