/**
 * NavigationBarColor — Expo Module thay thế react-native-navigation-bar-color.
 * Chạy trên JSI khi New Architecture bật, không qua Bridge.
 */
import { requireNativeModule } from 'expo'
import type { NativeModule } from 'expo'

export interface NavigationBarColorModuleSpec extends NativeModule {
  changeNavigationBarColor(
    backgroundColor: string,
    light: boolean,
    animated: boolean
  ): Promise<{ success: boolean }>
  hideNavigationBar(): Promise<{ success: boolean }>
  showNavigationBar(): Promise<{ success: boolean }>
}

let nativeModule: NavigationBarColorModuleSpec | null = null

try {
  nativeModule = requireNativeModule<NavigationBarColorModuleSpec>('NavigationBarColor')
} catch {
  // Module không khả dụng (Expo Go, web, iOS)
}

export default nativeModule
