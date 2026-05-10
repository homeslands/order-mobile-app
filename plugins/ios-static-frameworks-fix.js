const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

// With use_frameworks! :linkage => :static (required by Firebase + Expo Swift modules),
// every pod becomes a framework with a Clang module map. Any ObjC RN wrapper pod
// whose umbrella header transitively imports <React/...> will "capture" React types
// into its own module, causing cascade "Declaration of X must be imported from module Y"
// errors in other pods.
//
// Fix: set DEFINES_MODULE = NO for confirmed ObjC-only RN wrapper pods so they don't
// generate competing modules. Swift pods and SDK pods keep their modules intact.
const PODFILE_PATCH = `
    # ── Static frameworks compatibility fix ────────────────────────────────────
    # ObjC-only RN wrapper pods whose umbrella headers transitively import
    # <React/...>, verified via umbrella header scan + Pods.xcodeproj Swift check.
    rn_wrapper_pods = %w[
      RNFBApp RNFBMessaging
      react-native-maps react-native-google-maps
      RNSVG RNScreens RNGestureHandler RNReanimated RNWorklets
      react-native-blob-util react-native-safe-area-context
      react-native-date-picker react-native-slider
      RNCAsyncStorage RNDateTimePicker EXImageLoader
      ReactAppDependencyProvider ReactCodegen
    ]

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end

      if rn_wrapper_pods.include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['DEFINES_MODULE'] = 'NO'
        end
      end

      # Dynamic fallback: catch any unlisted ObjC pod whose public headers import React
      unless rn_wrapper_pods.include?(target.name)
        pod_public_headers = Dir.glob("#{installer.sandbox.root}/Headers/Public/#{target.name}/**/*.h")
        if pod_public_headers.any? { |h| File.read(h).include?('#import <React/') rescue false }
          target.build_configurations.each do |config|
            config.build_settings['DEFINES_MODULE'] = 'NO'
          end
        end
      end

      if target.name == 'GoogleMaps'
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
          config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
          config.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
        end
      end
    end

    installer.aggregate_targets.each do |aggregate|
      aggregate.user_project.native_targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
      aggregate.user_project.save
    end
    # ── End static frameworks compatibility fix ────────────────────────────────
`

module.exports = function withIosStaticFrameworksFix(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const podfilePath = path.join(mod.modRequest.platformProjectRoot, 'Podfile')
      let podfile = fs.readFileSync(podfilePath, 'utf8')

      if (podfile.includes('static frameworks compatibility fix')) {
        return mod
      }

      // Insert after react_native_post_install(...) closing paren + newline
      podfile = podfile.replace(
        /(\s+react_native_post_install\(\s*installer[\s\S]*?\)\s*\n)/,
        `$1${PODFILE_PATCH}`,
      )

      fs.writeFileSync(podfilePath, podfile)
      return mod
    },
  ])
}
