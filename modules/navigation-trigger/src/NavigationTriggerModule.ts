import { NativeModule, requireNativeModule } from 'expo'

declare class NavigationTriggerModule extends NativeModule {
  // View-only module — no module-level functions
}

let mod: NavigationTriggerModule | null = null
try {
  mod = requireNativeModule<NavigationTriggerModule>('NavigationTrigger')
} catch {
  // Native module unavailable (Expo Go) — fallback handled in NavigationTriggerView
}

export default mod
