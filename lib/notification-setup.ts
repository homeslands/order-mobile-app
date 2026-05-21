import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

import { preloadNotificationSound, preloadOrderReadySound } from '@/lib/notification-sound'

// Foreground: suppress OS banner/sound — app handles via onMessage toast + sound.
// Background: OS handles automatically (this handler only applies in foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
})

// Channel creation is fire-and-forget on Android but downstream code (FCM token
// registration) must NOT race ahead — expose a single Promise the rest of the
// app can await once before registering for push. On iOS the Promise resolves
// immediately because channels are an Android-only concept.
let _channelsReady: Promise<void> | null = null

function createChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve()

  return Promise.allSettled([
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F7A737',
      sound: 'notification.mp3',
    }),
    Notifications.setNotificationChannelAsync('order-needs-ready-to-get', {
      name: 'Thông báo lấy đơn',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 250, 1000, 250, 1000, 250, 1250],
      lightColor: '#F7A737',
      sound: 'railway_ingle',
    }),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.error('[Notifications] Channel setup failed:', r.reason)
      }
    }
  })
}

export function awaitChannelsReady(): Promise<void> {
  if (!_channelsReady) _channelsReady = createChannels()
  return _channelsReady
}

// Kick off channel creation eagerly at module load so the Promise is already
// (likely) resolved by the time auth rehydrates.
void awaitChannelsReady()

// Preload both sounds so the first foreground shot has zero load latency.
preloadNotificationSound()
preloadOrderReadySound()
