// Dynamic config — overrides static app.json values that depend on env vars.
// Expo loads .env automatically for local dev; EAS injects secrets at build time.
/** @param {{ config: import('@expo/config-types').ExpoConfig }} ctx */
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    // File Firebase bị gitignore → EAS Build (chỉ upload file git track) không
    // có nó. Trên EAS, file env var trỏ tới đường dẫn file đã tải về; ở local
    // biến này undefined nên fallback về đường dẫn tĩnh trong app.json.
    googleServicesFile:
      process.env.GOOGLE_SERVICE_INFO_PLIST ?? config.ios?.googleServicesFile,
    config: {
      ...config.ios?.config,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAP_API_KEY ?? '',
    },
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAP_API_KEY ?? '',
      },
    },
  },
})
