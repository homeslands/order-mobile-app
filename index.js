/**
 * Custom entry — chạy trước AppRegistry.registerComponent.
 *
 * Thứ tự bắt buộc:
 * 1. enableScreens(true) + enableFreeze(true) — trước khi bất kỳ Screen nào render
 * 2. expo-router/entry — registerComponent + mount app
 */
import './lib/navigation-setup'
import 'expo-router/entry'
