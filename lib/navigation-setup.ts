/**
 * Bootstrap cho navigation đạt 60fps/120fps:
 * React Navigation + Native Stack (Expo Router) + React Native Screens.
 *
 * Gọi ngay khi app khởi động, trước khi render bất kỳ navigator nào.
 */
import { enableFreeze, enableScreens } from 'react-native-screens'

enableScreens(true)
enableFreeze(true)

export { enableFreeze, enableScreens }
