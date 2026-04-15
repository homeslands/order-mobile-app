import ExpoModulesCore
import UIKit

class NavigationTriggerView: ExpoView {
  let onPress = EventDispatcher()

  var href: String = ""
  var navType: String = "push"

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
    addGestureRecognizer(tap)
    isUserInteractionEnabled = true
  }

  @objc private func handleTap() {
    onPress([
      "href": href,
      "type": navType,
    ])
  }
}
