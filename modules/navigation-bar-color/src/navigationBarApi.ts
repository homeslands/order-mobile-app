/**
 * API tương thích với react-native-navigation-bar-color.
 * Gọi Native qua JSI (Expo Module), fallback khi không có module.
 */
import { Platform } from 'react-native'
import NavigationBarColorModule from './NavigationBarColorModule'

export async function changeNavigationBarColor(
  color: string = '#000000',
  light: boolean = false,
  animated: boolean = true,
): Promise<{ success: boolean }> {
  if (Platform.OS !== 'android') {
    return { success: false }
  }
  if (!NavigationBarColorModule) {
    return { success: false }
  }
  try {
    const result = await NavigationBarColorModule.changeNavigationBarColor(
      color,
      light,
      animated,
    )
    return result ?? { success: true }
  } catch {
    return { success: false }
  }
}

export async function hideNavigationBar(): Promise<{ success: boolean }> {
  if (Platform.OS !== 'android') {
    return { success: false }
  }
  if (!NavigationBarColorModule) {
    return { success: false }
  }
  try {
    const result = await NavigationBarColorModule.hideNavigationBar()
    return result ?? { success: true }
  } catch {
    return { success: false }
  }
}

export async function showNavigationBar(): Promise<{ success: boolean }> {
  if (Platform.OS !== 'android') {
    return { success: false }
  }
  if (!NavigationBarColorModule) {
    return { success: false }
  }
  try {
    const result = await NavigationBarColorModule.showNavigationBar()
    return result ?? { success: true }
  } catch {
    return { success: false }
  }
}
