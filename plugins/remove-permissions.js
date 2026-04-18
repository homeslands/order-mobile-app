/**
 * Custom Expo config plugin — strip unwanted Android permissions from BOTH sources:
 *
 * SOURCE 1 — Config plugins (expo-media-library, expo-image-picker, expo-av…)
 *   These inject permissions into android/app/src/main/AndroidManifest.xml during
 *   `expo prebuild`. We filter them out of the uses-permission array.
 *
 * SOURCE 2 — Native AndroidManifest.xml inside node_modules (e.g.
 *   expo-image-picker, expo-image, expo-file-system each have their own manifest
 *   declaring RECORD_AUDIO / READ_EXTERNAL_STORAGE). These are merged by Gradle
 *   AFTER prebuild — config plugin filters have no effect on them.
 *
 *   Fix: add a `tools:node="remove"` entry for each unwanted permission. Gradle's
 *   manifest merger honours this annotation and strips the permission even when a
 *   dependency re-declares it.
 *
 * This plugin must stay LAST in app.json plugins array so it runs after all other
 * plugins have registered their permissions.
 */
const { withAndroidManifest } = require('@expo/config-plugins')

const PERMISSIONS_TO_REMOVE = [
  // Media read — system photo picker and MediaStore.createAsset need no read access.
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_EXTERNAL_STORAGE',
  // Audio/video — app never records audio or accesses video files.
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VIDEO',
  // Overlay — never used.
  'android.permission.SYSTEM_ALERT_WINDOW',
]

module.exports = function withRemovePermissions(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults

    // ── Step 1: Remove from config-plugin-injected entries ──────────────────
    for (const tag of ['uses-permission', 'uses-permission-sdk-23']) {
      const existing = manifest.manifest[tag] ?? []
      manifest.manifest[tag] = existing.filter(
        (perm) => !PERMISSIONS_TO_REMOVE.includes(perm?.$?.['android:name']),
      )
    }

    // ── Step 2: Add tools:node="remove" to block native manifest merges ──────
    // Gradle merges AndroidManifest.xml files from every dependency at build time.
    // tools:node="remove" tells the merger to strip the entry even when a library
    // re-declares it — this is the only way to remove native-manifest permissions.
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = []
    }
    for (const permission of PERMISSIONS_TO_REMOVE) {
      manifest.manifest['uses-permission'].push({
        $: {
          'android:name': permission,
          'tools:node': 'remove',
        },
      })
    }

    return mod
  })
}
