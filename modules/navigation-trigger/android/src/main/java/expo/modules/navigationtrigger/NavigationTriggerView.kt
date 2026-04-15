package expo.modules.navigationtrigger

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class NavigationTriggerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onPress by EventDispatcher()

  private var href: String? = null
  private var navType: String = "push"

  init {
    isClickable = true
    setOnClickListener {
      onPress(
        mapOf(
          "href" to (href ?: ""),
          "type" to navType,
        ),
      )
    }
  }

  fun setHref(value: String?) {
    href = value
  }

  fun setNavType(value: String?) {
    navType = value ?: "push"
  }
}
