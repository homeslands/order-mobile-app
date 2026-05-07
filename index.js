/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. firebase-background-handler — trước khi React start, để setBackgroundMessageHandler
 *    được đăng ký cho killed/background state
 * 2. navigation-setup: enableScreens(true) + enableFreeze(true) — trước khi bất kỳ Screen nào render
 * 3. expo-router/entry — registerComponent + mount app
 */
import './lib/firebase-background-handler'
import './lib/navigation-setup'
import 'expo-router/entry'
