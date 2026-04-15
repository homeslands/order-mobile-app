package expo.modules.navigationtrigger

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NavigationTriggerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NavigationTrigger")

    View(NavigationTriggerView::class) {
      Prop("href") { view: NavigationTriggerView, href: String? ->
        view.setHref(href)
      }
      Prop("type") { view: NavigationTriggerView, type: String? ->
        view.setNavType(type)
      }
      Events("onPress")
    }
  }
}
