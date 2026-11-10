import Expo
import React
import UIKit

// Vòng đời UIScene. App build bằng SDK iOS 27 mà chưa dùng UIScene thì iOS 27
// dừng app ngay lúc mở. Sinh ra bởi plugins/with-ui-scene.js, không sửa tay.
//
// Rút gọn từ ExpoAppSceneDelegate của Expo SDK 57. Nâng lên SDK 57+ thì bỏ
// plugin và dùng bản của Expo.
//
// Với UIScene, UIKit không gọi các hàm vòng đời / URL / user activity của
// AppDelegate nữa mà gọi ở đây, nên chuyển tiếp về AppDelegate. AppDelegate
// (ExpoAppDelegate) vừa báo cho subscriber của Expo, vừa gọi RCTLinkingManager.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate, let factory = appDelegate.reactNativeFactory else {
      // AppDelegate luôn tạo factory trong didFinishLaunching, trước khi scene
      // nối vào. Tới đây là cấu hình sai, dừng sớm thay vì hiện màn trắng.
      fatalError("SceneDelegate: AppDelegate chưa tạo reactNativeFactory")
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // expo-system-ui, RNFBMessaging còn đọc UIApplication.shared.delegate.window.
    appDelegate.window = window

    // Link mở app từ trạng thái tắt nằm trong connectionOptions, không còn trong
    // launchOptions. Linking.getInitialURL() của React Native chỉ đọc
    // launchOptions nên dựng lại ở đây.
    let webActivity = connectionOptions.userActivities.first {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: Self.launchOptions(
        url: connectionOptions.urlContexts.first?.url,
        userActivity: webActivity
      )
    )
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    window = nil
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  // Link scheme trend:// khi app đang chạy.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = appDelegate?.application(
        UIApplication.shared,
        open: context.url,
        options: Self.openURLOptions(from: context.options)
      )
    }
  }

  // Universal Links khi app đang chạy.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  // Khoá dựng từ chuỗi gốc: các hằng UIApplication.LaunchOptionsKey bị đánh dấu
  // deprecated từ iOS 26, nhưng React Native vẫn đọc đúng các khoá này.
  private static func launchOptions(
    url: URL?,
    userActivity: NSUserActivity?
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var options: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url {
      options[UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsURLKey")] = url
    }
    if let userActivity {
      options[UIApplication.LaunchOptionsKey(
        rawValue: "UIApplicationLaunchOptionsUserActivityDictionaryKey"
      )] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }
    return options.isEmpty ? nil : options
  }

  private static func openURLOptions(
    from sceneOptions: UIScene.OpenURLOptions
  ) -> [UIApplication.OpenURLOptionsKey: Any] {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let sourceApplication = sceneOptions.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }
    if let annotation = sceneOptions.annotation {
      options[.annotation] = annotation
    }
    options[.openInPlace] = sceneOptions.openInPlace
    return options
  }
}
