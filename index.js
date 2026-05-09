/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. firebase-background-handler — setBackgroundMessageHandler trước khi React start
 * 2. notification-setup — setNotificationHandler + Android channel trước khi React start
 * 3. navigation-setup: enableScreens(true) + enableFreeze(true) — trước khi bất kỳ Screen nào render
 * 4. expo-router/entry — registerComponent + mount app
 */
import './lib/firebase-background-handler'
import './lib/notification-setup'
import './lib/navigation-setup'
import 'expo-router/entry'
