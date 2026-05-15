import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

// Foreground: suppress OS banner/sound — app handles via onMessage toast + sound.
// Background: OS handles automatically (this handler only applies in foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
})

// Android: create channel at startup (unconditional) so background notifications
// that arrive before the user logs in are not silently dropped for missing channel.
//
// vibrationPattern: long continuous-feeling buzz for high-priority order alerts
// when app is in background / killed. Pattern is [delay, vibrate, pause,
// vibrate, ...] — three 500ms buzzes with 150ms gaps ≈ 1.95s of strong attention.
// Once a channel is created with a pattern, Android caches it — changing the
// pattern only takes effect on app reinstall (Android limitation, by design).
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 150, 500, 150, 500],
    lightColor: '#F7A737',
    sound: 'notification.mp3',
  }).catch((e) =>
    // eslint-disable-next-line no-console
    console.error(
      '[Notifications] Failed to create Android default channel:',
      e,
    ),
  )
}
