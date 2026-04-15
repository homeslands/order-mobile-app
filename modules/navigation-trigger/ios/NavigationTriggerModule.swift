import ExpoModulesCore

public class NavigationTriggerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NavigationTrigger")

    View(NavigationTriggerView.self) {
      Prop("href") { (view: NavigationTriggerView, href: String?) in
        view.href = href ?? ""
      }
      Prop("type") { (view: NavigationTriggerView, type: String?) in
        view.navType = type ?? "push"
      }
      Events("onPress")
    }
  }
}
