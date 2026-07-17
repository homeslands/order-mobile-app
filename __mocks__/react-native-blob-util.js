// Jest mock for react-native-blob-util.
// The real module instantiates `new NativeEventEmitter()` at import time, which
// throws under the jest environment (no native module). Tests only import it
// transitively via utils/download-pdf.ts and never invoke it, so a minimal
// stand-in that satisfies the shape used there is enough.
module.exports = {
  __esModule: true,
  default: {
    fs: {
      dirs: { CacheDir: '/mock/cache', DocumentDir: '/mock/documents' },
      writeFile: jest.fn(() => Promise.resolve()),
      unlink: jest.fn(() => Promise.resolve()),
    },
    MediaCollection: {
      copyToMediaStore: jest.fn(() => Promise.resolve('/mock/downloads/file.pdf')),
    },
    config: jest.fn(() => ({ fetch: jest.fn(() => Promise.resolve()) })),
  },
}
