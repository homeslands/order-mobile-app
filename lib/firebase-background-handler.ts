import messaging from '@react-native-firebase/messaging'
import * as Notifications from 'expo-notifications'

export async function incrementBadgeForBackgroundMessage(): Promise<void> {
  try {
    const current = await Notifications.getBadgeCountAsync()
    await Notifications.setBadgeCountAsync(current + 1)
  } catch {
    // Badge update is best-effort — hydrateFromApi corrects on next app open.
  }
}

messaging().setBackgroundMessageHandler(incrementBadgeForBackgroundMessage)
