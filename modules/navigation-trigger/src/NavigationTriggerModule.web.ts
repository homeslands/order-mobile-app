import { registerWebModule, NativeModule } from 'expo'

class NavigationTriggerModule extends NativeModule {
  // View-only module — no module-level functions for web
}

export default registerWebModule(NavigationTriggerModule, 'NavigationTrigger')
