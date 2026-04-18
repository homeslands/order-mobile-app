/**
 * Custom Expo config plugin — remove unwanted Android permissions that are
 * injected by third-party plugins (e.g. expo-media-library adds READ_MEDIA_VIDEO
 * and READ_MEDIA_AUDIO even when the app only needs images).
 *
 * Runs last via withAndroidManifest, after all other plugins, so removals
 * are guaranteed to survive plugin ordering issues.
 */
const { withAndroidManifest } = require('@expo/config-plugins')

const PERMISSIONS_TO_REMOVE = [
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.SYSTEM_ALERT_WINDOW',
]

module.exports = function withRemovePermissions(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults
    const permissions = manifest.manifest['uses-permission'] ?? []

    manifest.manifest['uses-permission'] = permissions.filter(
      (perm) =>
        !PERMISSIONS_TO_REMOVE.includes(
          perm.$['android:name'],
        ),
    )

    return mod
  })
}
