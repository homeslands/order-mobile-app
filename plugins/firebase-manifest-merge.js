const { withAndroidManifest } = require('@expo/config-plugins')

// Firebase library manifests also declare these meta-data keys, causing a
// merge conflict unless we annotate our entries with tools:replace so the
// merger knows to prefer our values over the library defaults.
const FIREBASE_META_REPLACES = [
  {
    name: 'com.google.firebase.messaging.default_notification_channel_id',
    replaceAttr: 'android:value',
  },
  {
    name: 'com.google.firebase.messaging.default_notification_color',
    replaceAttr: 'android:resource',
  },
]

module.exports = function withFirebaseManifestMerge(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0]
    if (!application?.['meta-data']) return mod

    for (const { name, replaceAttr } of FIREBASE_META_REPLACES) {
      const entry = application['meta-data'].find(
        (m) => m.$?.['android:name'] === name,
      )
      if (entry) {
        entry.$['tools:replace'] = replaceAttr
      }
    }

    return mod
  })
}
