const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

// React Native 0.81 ships its core as a prebuilt React.xcframework and picks the
// Debug or Release artifact from a CocoaPods script phase on the React-Core-prebuilt
// target:
//
//   CONFIG="Release"
//   if echo $GCC_PREPROCESSOR_DEFINITIONS | grep -q "DEBUG=1"; then CONFIG="Debug"; fi
//
// CocoaPods never writes DEBUG=1 into a pod target's xcconfig — the generated
// React-Core-prebuilt.debug.xcconfig only carries `$(inherited) COCOAPODS=1` — so the
// script always resolves to Release and unpacks the Release core, even for a Debug build.
//
// That breaks linking because Sealable has two incompatible definitions
// (ReactCommon/react/renderer/core/Sealable.h): under REACT_NATIVE_PRODUCTION it is a
// header-only inline class that emits no symbols, and under REACT_NATIVE_DEBUG it declares
// out-of-line constructors defined in Sealable.cpp. A Debug app build compiles
// ExpoModulesCore with REACT_NATIVE_DEBUG, so ExpoFabricViewObjC.mm references
// facebook::react::Sealable::Sealable() — which the Release core does not export:
//
//   Undefined symbols for architecture arm64
//     facebook::react::Sealable::Sealable()
//     referenced from expo::ExpoViewProps::ExpoViewProps() in libExpoModulesCore.a
//
// Fix: declare DEBUG=1 on the React-Core-prebuilt target's Debug configuration so the
// script phase resolves to Debug. The target wraps a vendored framework and compiles no
// sources of its own, so the define is purely a signal to that script phase.
//
// Release builds were never affected and are unchanged.
const PODFILE_PATCH = `
    # ── Prebuilt React core Debug artifact fix ─────────────────────────────────
    # React-Core-prebuilt's script phase greps GCC_PREPROCESSOR_DEFINITIONS for
    # DEBUG=1 to decide which React.xcframework to unpack. CocoaPods never writes
    # that define into a pod target's xcconfig, so it always resolves to Release —
    # and the Release core omits the out-of-line facebook::react::Sealable symbols
    # that a Debug build of ExpoModulesCore references. This target compiles no
    # sources, so the define only steers that script phase.
    prebuilt_rncore = installer.pods_project.targets.find do |t|
      t.name == 'React-Core-prebuilt'
    end

    if prebuilt_rncore
      prebuilt_rncore.build_configurations.each do |config|
        next unless config.name == 'Debug'

        defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        next if defs.any? { |d| d.to_s.include?('DEBUG=1') }

        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs + ['DEBUG=1']
      end
    end
    # ── End prebuilt React core Debug artifact fix ─────────────────────────────
`

module.exports = function withIosPrebuiltRncoreDebugFix(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const podfilePath = path.join(
        mod.modRequest.platformProjectRoot,
        'Podfile',
      )
      let podfile = fs.readFileSync(podfilePath, 'utf8')

      if (podfile.includes('Prebuilt React core Debug artifact fix')) {
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
