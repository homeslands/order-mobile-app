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

// Bump this when channel properties (sound, vibration, importance) change.
// Triggers delete+recreate on first launch after an update, but not on every cold start.
// Android ignores property updates on existing channels — delete+recreate is the only way.
const CHANNEL_VERSION = '4'
const CHANNEL_VERSION_KEY = '@notif/channelVersion'

async function createChannels(): Promise<void> {
  if (Platform.OS !== 'android') return

  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
  const stored = await AsyncStorage.getItem(CHANNEL_VERSION_KEY).catch(() => null)

  if (stored !== CHANNEL_VERSION) {
    await Promise.allSettled([
      Notifications.deleteNotificationChannelAsync('default'),
      Notifications.deleteNotificationChannelAsync('order-needs-ready-to-get'),
    ])
    await AsyncStorage.setItem(CHANNEL_VERSION_KEY, CHANNEL_VERSION).catch(() => {})
  }

  // sound: bare basename (no extension) — expo-notifications resolves via res/raw identifier.
  // Using Promise.all so a broken channel definition fails loudly instead of silently.
  await Promise.all([
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F7A737',
      sound: 'notification',
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync('order-needs-ready-to-get', {
      name: 'Thông báo lấy đơn',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 250, 1000, 250, 1000, 250, 1250],
      lightColor: '#F7A737',
      sound: 'ding',
      enableVibrate: true,
    }),
  ])
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
