/**
 * Custom Expo config plugin — configure Android release signing.
 *
 * Inserts a `release` signingConfig into android/app/build.gradle and switches
 * the release buildType to use it WHEN `MYAPP_UPLOAD_STORE_FILE` is defined
 * in gradle.properties. If not defined, release falls back to the debug key
 * so dev-style `./gradlew assembleRelease` still works without signing setup.
 *
 * Setup:
 *   1. Store keystore OUTSIDE the repo (survives `prebuild --clean`):
 *        e.g. ~/keystores/trend-coffee/release.jks
 *   2. Add to ~/.gradle/gradle.properties (GLOBAL, never in repo):
 *        MYAPP_UPLOAD_STORE_FILE=/absolute/path/to/release.jks
 *        MYAPP_UPLOAD_KEY_ALIAS=<alias>
 *        MYAPP_UPLOAD_STORE_PASSWORD=<store password>
 *        MYAPP_UPLOAD_KEY_PASSWORD=<key password>
 *   3. `npx expo prebuild -p android` — plugin rewrites build.gradle.
 *   4. `cd android && ./gradlew bundleRelease` → app-release.aab
 */
const { withAppBuildGradle } = require('@expo/config-plugins')

const MARKER = 'MYAPP_UPLOAD_STORE_FILE'

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents

    if (contents.includes(MARKER)) {
      return mod
    }

    contents = contents.replace(
      /(signingConfigs\s*\{\s*debug\s*\{[^}]+\})/,
      `$1
        release {
            if (project.hasProperty('${MARKER}')) {
                storeFile file(${MARKER})
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }`,
    )

    contents = contents.replace(
      /(release\s*\{[^}]*?signingConfig\s+)signingConfigs\.debug/,
      `$1project.hasProperty('${MARKER}') ? signingConfigs.release : signingConfigs.debug`,
    )

    mod.modResults.contents = contents
    return mod
  })
}
