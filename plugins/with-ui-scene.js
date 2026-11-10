const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

// Chuyển app sang vòng đời UIScene. App build bằng SDK iOS 27 (Xcode 27) mà
// chưa dùng UIScene thì iOS 27 dừng app ngay lúc mở
// (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption → SIGTRAP).
// Expo SDK 54 chưa hỗ trợ, SDK 57 có sẵn ExpoAppSceneDelegate — nâng lên đó
// thì bỏ plugin này.
//
// 1. Info.plist khai báo một scene, trỏ tới SceneDelegate.
// 2. Chép plugins/ui-scene/SceneDelegate.swift vào target app.
// 3. AppDelegate thôi tự dựng window và chạy React Native — SceneDelegate làm.

const SCENE_DELEGATE_FILE = 'SceneDelegate.swift'
const MARKER = '// [ui-scene]'

function applySceneManifest(infoPlist) {
  infoPlist.UIApplicationSceneManifest = {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        },
      ],
    },
  }
  return infoPlist
}

// Bỏ dòng tạo window và lời gọi factory.startReactNative(…) trong
// didFinishLaunching. Để lại một comment chứa đúng chuỗi
// "factory.startReactNative(": plugin @react-native-firebase/app neo vào chuỗi
// này để chèn FirebaseApp.configure() phía trên, nên dù nó chạy trước hay sau
// plugin này, Firebase vẫn được khởi tạo trong didFinishLaunching.
function applySceneAppDelegate(src) {
  if (src.includes(MARKER)) return src
  const windowLine =
    /^[ \t]*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n/m
  const startCall =
    /^[ \t]*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\n/m
  if (!windowLine.test(src) || !startCall.test(src)) {
    throw new Error(
      '[with-ui-scene] AppDelegate.swift khác mẫu Expo SDK 54 — kiểm tra lại plugin.',
    )
  }
  return src
    .replace(windowLine, '')
    .replace(
      startCall,
      `    ${MARKER} SceneDelegate dựng window và gọi factory.startReactNative(…).\n`,
    )
}

const withUIScene = (config) => {
  config = withInfoPlist(config, (c) => {
    applySceneManifest(c.modResults)
    return c
  })

  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('[with-ui-scene] chỉ hỗ trợ AppDelegate.swift')
    }
    c.modResults.contents = applySceneAppDelegate(c.modResults.contents)
    return c
  })

  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(
        c.modRequest.projectRoot,
      )
      fs.copyFileSync(
        path.join(__dirname, 'ui-scene', SCENE_DELEGATE_FILE),
        path.join(
          c.modRequest.platformProjectRoot,
          projectName,
          SCENE_DELEGATE_FILE,
        ),
      )
      return c
    },
  ])

  config = withXcodeProject(config, (c) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      c.modRequest.projectRoot,
    )
    const filepath = `${projectName}/${SCENE_DELEGATE_FILE}`
    if (!c.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: c.modResults,
      })
    }
    return c
  })

  return config
}

module.exports = withUIScene
module.exports.applySceneAppDelegate = applySceneAppDelegate
module.exports.applySceneManifest = applySceneManifest
