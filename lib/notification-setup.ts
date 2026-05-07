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
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7A737',
    sound: 'notification.mp3',
  }).catch(() => {})
}
