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

// Android: fires for any background/killed notification — increments OS badge.
// iOS: only fires for data-only FCM messages (no `notification` field). Standard
// notification messages set the badge via apns.payload.aps.badge (backend side).
messaging().setBackgroundMessageHandler(incrementBadgeForBackgroundMessage)
