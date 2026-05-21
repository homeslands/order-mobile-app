/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. firebase-background-handler — increments OS badge when a notification
 *    arrives while the app is backgrounded or killed (Android). On iOS this
 *    handler does not fire for FCM notification messages; badge is set by
 *    apns.payload.aps.badge from the backend.
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
