/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. firebase-background-handler — dummy anti-warning stub. BE gửi notification
 *    message (FCM SDK render natively), nên handler này chỉ tồn tại để silence
 *    warning của @react-native-firebase/messaging.
 * 2. notification-setup — setNotificationHandler + Android channel readiness
 *    Promise + preload notification.mp3. Phải chạy trước khi token registration
 *    bắt đầu (channels phải tồn tại trước khi nhận push trên Android).
 * 3. navigation-setup: enableScreens(true) + enableFreeze(true) — trước khi
 *    bất kỳ Screen nào render.
 * 4. expo-router/entry — registerComponent + mount app.
 */
import './lib/firebase-background-handler'
import './lib/notification-setup'
import './lib/navigation-setup'
import 'expo-router/entry'
