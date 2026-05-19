/**
 * Firebase background message handler — DUMMY anti-warning stub.
 *
 * Why dummy: BE sends FCM `notification messages` (payload contains a
 * `notification` field). When that field is present, the FCM SDK renders the
 * system tray notification natively on both iOS and Android. The JS handler
 * would only run for `data-only` messages, which we never send.
 *
 * Why we keep registering: @react-native-firebase/messaging emits a warning on
 * every background delivery if no handler is set. Registering an empty handler
 * silences that warning without altering behavior.
 *
 * Flow (current production):
 *   - Background / killed: FCM SDK renders tray notification → user taps →
 *     onNotificationOpenedApp / getInitialNotification handles navigation.
 *   - Foreground: onMessage handles via use-notification-listener.
 *
 * Tap handling lives in hooks/use-notification-response.ts.
 */
import messaging from '@react-native-firebase/messaging'

messaging().setBackgroundMessageHandler(async () => {
  // Intentionally empty — FCM renders the notification natively because the
  // BE payload includes a `notification` field. See file-level comment.
})
