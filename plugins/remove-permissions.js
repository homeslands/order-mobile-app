/**
 * Custom Expo config plugin — remove unwanted Android permissions that are
 * injected by third-party plugins (e.g. expo-media-library adds READ_MEDIA_IMAGES,
 * READ_MEDIA_VIDEO, READ_MEDIA_AUDIO even when the app only writes to MediaStore).
 *
 * On Android 13+, expo-image-picker uses the system photo picker which needs no
 * READ_MEDIA_IMAGES permission. Saving to MediaStore (writeOnly: true) also needs
 * no read permissions. We only keep WRITE_EXTERNAL_STORAGE (capped at API 29).
 *
 * Runs last via withAndroidManifest, after all other plugins, so removals
 * are guaranteed to survive plugin ordering issues.
 */
const { withAndroidManifest } = require('@expo/config-plugins')

const PERMISSIONS_TO_REMOVE = [
  // Media read permissions — not needed: system photo picker handles selection
  // and MediaStore.createAsset handles saving without read access.
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_EXTERNAL_STORAGE',
  // Audio/video — app never accesses audio or video files.
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VIDEO',
  // Overlay — never used.
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
