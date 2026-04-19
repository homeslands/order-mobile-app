/**
 * Custom Expo config plugin — restrict Android ABI targets to 64-bit ARM only.
 *
 * Injects `ndk { abiFilters 'arm64-v8a' }` into the defaultConfig block of
 * android/app/build.gradle during `expo prebuild`.
 *
 * Why arm64-v8a only:
 *   - minSdkVersion 24 (Android 7.0, 2016) — virtually all devices at this
 *     API level shipped with 64-bit CPUs by 2024+.
 *   - Dropping armeabi-v7a (32-bit) reduces native library size in the AAB
 *     and eliminates x86/x86_64 emulator ABI linker errors at build time.
 *   - Play Store will not deliver the app to 32-bit-only devices.
 */
const { withAppBuildGradle } = require('@expo/config-plugins')

module.exports = function withAbiFilters(config) {
  return withAppBuildGradle(config, (mod) => {
    const contents = mod.modResults.contents

    if (contents.includes('abiFilters')) {
      // Already injected — skip to avoid duplicates on re-prebuild.
      return mod
    }

    mod.modResults.contents = contents.replace(
      /(defaultConfig\s*\{)/,
      `$1\n        ndk {\n            // 64-bit ARM only — see plugins/abi-filters.js\n            abiFilters 'arm64-v8a'\n        }`,
    )

    return mod
  })
}
