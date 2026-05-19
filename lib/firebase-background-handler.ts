/**
 * Firebase background message handler.
 *
 * REQUIRES BE to send data-only FCM messages (no `notification` field).
 * When `notification` field is present, Firebase renders natively and this
 * handler ALSO runs — resulting in duplicate notifications. Data-only messages
 * let FE control channel, sound, and vibration fully.
 *
 * Flow (background / killed):
 *   data-only FCM → setBackgroundMessageHandler → parse data.payload.message
 *   → scheduleNotificationAsync with correct Android channel
 *   → system shows notification with right sound + vibration
 *   → tap → getLastNotificationResponseAsync → navigate
 *
 * Flow (foreground):
 *   data-only FCM → onMessage → use-notification-listener handles as before
 */
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { NotificationMessageCode } from '@/constants/notification.constant'

function parsePayload(data: Record<string, unknown>): Record<string, string> {
  const raw = data.payload
  if (typeof raw !== 'string') return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function channelForMessage(messageCode: string): string {
  return messageCode === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET
    ? 'order-ready'
    : 'default'
}

async function scheduleLocalNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const rawData = (remoteMessage.data ?? {}) as Record<string, unknown>
  const parsed = parsePayload(rawData)
  const messageCode = parsed.message ?? ''
  const isOrderReady =
    messageCode === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET

  // Title/body: prefer data.payload fields (BE should include when going data-only),
  // fall back to notification field during transition period, then hardcoded defaults.
  const title =
    parsed.title ||
    remoteMessage.notification?.title ||
    (isOrderReady ? 'Đơn của bạn đã sẵn sàng' : 'Thông báo')
  const body = parsed.body || remoteMessage.notification?.body || ''

  const channel = channelForMessage(messageCode)

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: body || undefined,
      data: rawData,
      // iOS: short sound for notification banner (looped sound plays in modal on open)
      ...(Platform.OS === 'ios' && {
        sound: isOrderReady ? 'ding.mp3' : 'notification.mp3',
      }),
    },
    // Android: ChannelAwareTriggerInput — fires immediately on the specified channel
    // iOS: null — fires immediately with default behavior
    trigger: Platform.OS === 'android' ? { channelId: channel } : null,
  })
}

messaging().setBackgroundMessageHandler(scheduleLocalNotification)
