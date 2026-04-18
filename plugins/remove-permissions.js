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

    // Handle both uses-permission and uses-permission-sdk-23 tags
    for (const tag of ['uses-permission', 'uses-permission-sdk-23']) {
      const permissions = manifest.manifest[tag] ?? []
      // eslint-disable-next-line no-console
      console.log(
        `[remove-permissions] ${tag} found:`,
        permissions.map((p) => p?.$?.['android:name']),
      )
      manifest.manifest[tag] = permissions.filter((perm) => {
        const name = perm?.$?.['android:name']
        const shouldRemove = PERMISSIONS_TO_REMOVE.includes(name)
        if (shouldRemove) {
          // eslint-disable-next-line no-console
          console.log(`[remove-permissions] Removing: ${name}`)
        }
        return !shouldRemove
      })
    }

    return mod
  })
}
