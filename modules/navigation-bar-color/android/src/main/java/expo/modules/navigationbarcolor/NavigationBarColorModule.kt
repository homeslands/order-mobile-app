package expo.modules.navigationbarcolor

import android.animation.ArgbEvaluator
import android.animation.ValueAnimator
import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.Window
import android.view.WindowManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val ERROR_NO_ACTIVITY = "E_NO_ACTIVITY"
private const val ERROR_NO_ACTIVITY_MESSAGE =
  "Tried to change the navigation bar while not attached to an Activity"
private const val ERROR_API_LEVEL = "API_LEVEL"
private const val ERROR_API_LEVEL_MESSAGE = "Only Android Lollipop and above is supported"

private val UI_FLAG_HIDE_NAV_BAR =
  View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY

class NavigationBarColorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NavigationBarColor")

    AsyncFunction("changeNavigationBarColor") { color: String, light: Boolean, animated: Boolean ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
        throw IllegalStateException(ERROR_API_LEVEL_MESSAGE)
      }
      val activity = appContext.currentActivity
        ?: throw IllegalStateException(ERROR_NO_ACTIVITY_MESSAGE)

      val window = activity.window
      val decorView = window.decorView

      when (color) {
        "transparent", "translucent" -> {
          window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
          window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
          if (color == "transparent") {
            window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
          } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
          }
          setNavigationBarTheme(decorView, light)
        }
        else -> {
          window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
          window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
          if (animated) {
            val colorFrom = window.navigationBarColor
            val colorTo = Color.parseColor(color)
            val animator = ValueAnimator.ofObject(ArgbEvaluator(), colorFrom, colorTo)
            animator.addUpdateListener { va ->
              window.navigationBarColor = va.animatedValue as Int
            }
            animator.start()
          } else {
            window.navigationBarColor = Color.parseColor(color)
          }
          setNavigationBarTheme(decorView, light)
        }
      }

      mapOf("success" to true)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("hideNavigationBar") {
      val activity = appContext.currentActivity
        ?: throw IllegalStateException(ERROR_NO_ACTIVITY_MESSAGE)
      activity.window.decorView.systemUiVisibility = UI_FLAG_HIDE_NAV_BAR
      mapOf("success" to true)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("showNavigationBar") {
      val activity = appContext.currentActivity
        ?: throw IllegalStateException(ERROR_NO_ACTIVITY_MESSAGE)
      activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
      mapOf("success" to true)
    }.runOnQueue(Queues.MAIN)
  }

  private fun setNavigationBarTheme(decorView: View, light: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      var flags = decorView.systemUiVisibility
      flags = if (light) {
        flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
      } else {
        flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
      }
      decorView.systemUiVisibility = flags
    }
  }
}
