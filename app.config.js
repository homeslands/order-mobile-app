// Dynamic config — overrides static app.json values that depend on env vars.
// Expo loads .env automatically for local dev; EAS injects secrets at build time.
/** @param {{ config: import('@expo/config-types').ExpoConfig }} ctx */
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAP_API_KEY ?? '',
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAP_API_KEY ?? '',
      },
    },
  },
})
