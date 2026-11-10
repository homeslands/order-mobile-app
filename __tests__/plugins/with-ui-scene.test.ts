// iOS 27 chặn app build bằng SDK iOS 27 mà chưa dùng vòng đời UIScene
// (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption → SIGTRAP lúc
// mở app). Plugin chuyển việc dựng window + chạy React Native từ AppDelegate
// sang SceneDelegate. ios/ do prebuild sinh ra nên sửa bằng plugin.
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  applySceneAppDelegate,
  applySceneManifest,
} = require('../../plugins/with-ui-scene')

const APP_DELEGATE = `    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
// @generated begin @react-native-firebase/app-didFinishLaunchingWithOptions - expo prebuild (DO NOT MODIFY) sync-x
FirebaseApp.configure()
// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('US1 AppDelegate không tự dựng window và chạy React Native nữa', () => {
  const out: string = applySceneAppDelegate(APP_DELEGATE)
  expect(out).not.toMatch(/UIWindow\(frame:/)
  expect(out).not.toMatch(/in: window/)
  expect(out).toMatch(/FirebaseApp\.configure\(\)/)
  expect(out).toMatch(/return super\.application/)
})

it('US2 giữ chỗ bám cho plugin Firebase dù Firebase chạy sau', () => {
  const noFirebase = APP_DELEGATE.replace(
    /\/\/ @generated begin[\s\S]*?@generated end[^\n]*\n/,
    '',
  )
  const out: string = applySceneAppDelegate(noFirebase)
  // Regex neo của @react-native-firebase/app (plugin/build/ios/appDelegate.js)
  expect(out).toMatch(/factory\.startReactNative\(/)
  expect(out).not.toMatch(/in: window/)
})

it('US3 chạy lại không đổi gì (prebuild không --clean)', () => {
  const once: string = applySceneAppDelegate(APP_DELEGATE)
  expect(applySceneAppDelegate(once)).toBe(once)
})

it('US4 AppDelegate lạ thì báo lỗi, không lặng lẽ bỏ qua', () => {
  expect(() => applySceneAppDelegate('class AppDelegate {}')).toThrow()
})

it('US5 Info.plist khai báo một scene, trỏ tới SceneDelegate', () => {
  const plist = applySceneManifest({})
  expect(plist.UIApplicationSceneManifest).toEqual({
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        },
      ],
    },
  })
})
