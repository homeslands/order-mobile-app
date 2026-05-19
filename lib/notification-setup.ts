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

// Android: create channels at startup (unconditional) so background notifications
// that arrive before the user logs in are not silently dropped for missing channel.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7A737',
    sound: 'notification.mp3',
  }).catch((e) =>
    // eslint-disable-next-line no-console
    console.error(
      '[Notifications] Failed to create Android default channel:',
      e,
    ),
  )

  Notifications.setNotificationChannelAsync('order-ready', {
    name: 'Thông báo lấy đơn',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000],
    lightColor: '#F7A737',
    sound: 'order_ready',
  }).catch((e) =>
    // eslint-disable-next-line no-console
    console.error(
      '[Notifications] Failed to create Android order-ready channel:',
      e,
    ),
  )
}
