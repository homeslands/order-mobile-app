// Load .env FIRST so EXPO_PUBLIC_* is available when Metro bundles
// (needed when running from Android Studio - Metro must have env before bundling)
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const projectRoot = path.resolve(__dirname);
dotenvExpand.expand(dotenv.config({ path: path.join(projectRoot, '.env') }));
dotenvExpand.expand(dotenv.config({ path: path.join(projectRoot, '.env.local') }));

// Hash .env files so Metro cache invalidates when env changes
const envHash = (() => {
  const files = ['.env', '.env.local'].map(f => path.join(projectRoot, f));
  const h = crypto.createHash('md5');
  for (const f of files) {
    if (fs.existsSync(f)) h.update(fs.readFileSync(f));
  }
  return h.digest('hex');
})();

// Load polyfills before any other modules
require('./polyfills');

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
 
const config = getDefaultConfig(__dirname);

// Optimize for faster Fast Refresh
config.watchFolders = [__dirname];

// Optimize resolver for better performance
config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver?.sourceExts || []), 'css'],
  assetExts: (config.resolver?.assetExts || []).filter((ext) => ext !== 'css'),
  // Add path alias support
  alias: {
    '@': path.resolve(__dirname),
  },
  // Exclude unnecessary folders from watching (improves performance)
  blockList: [
    /node_modules\/.*\/node_modules\/react-native\/.*/,
  ],
};

// Optimize transformer for faster builds
// Set ANALYZE_BUNDLE=true to enable source maps for bundle analysis (dev only)
const ANALYZE_BUNDLE = process.env.ANALYZE_BUNDLE === 'true';
// Keep names in dev/analyze for readable stack traces; strip in production for smaller bundle
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    keep_classnames: !IS_PRODUCTION,
    keep_fnames: !IS_PRODUCTION,
  },
  // Enable inline requires for faster startup
  inlineRequires: true,
  // Source maps only when analyzing — no impact on production builds
  ...(ANALYZE_BUNDLE ? { sourceMapInline: true } : {}),
};

// Increase max workers for faster bundling
config.maxWorkers = 2;

// Include .env hash in cache key so bundle rebuilds when env changes
config.cacheVersion = envHash;
 
module.exports = withNativeWind(config, { input: './app/global.css' })