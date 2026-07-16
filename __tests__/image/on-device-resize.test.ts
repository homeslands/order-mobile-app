let mockResizeCalls = 0
jest.mock('@/lib/image/resize-config', () => ({
  ON_DEVICE_RESIZE_ENABLED: true,
  RESIZE_CONCURRENCY: 2,
  THUMBNAIL_JPEG_COMPRESS: 0.8,
}))
const mockCache: Record<string, string> = {}
jest.mock('@/lib/image/thumbnail-cache', () => ({
  getCachedThumbnail: (u: string) => mockCache[u] ?? null,
  putCachedThumbnail: (u: string, _w: number, uri: string) => {
    mockCache[u] = uri
  },
  invalidateThumbnail: jest.fn(),
  thumbnailKey: (u: string, w: number) => `${u}|${w}`,
}))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: () => Promise.resolve(),
  getInfoAsync: () => Promise.resolve({ exists: false }),
  downloadAsync: (_url: string, to: string) => Promise.resolve({ uri: to }),
  deleteAsync: () => Promise.resolve(),
}))
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: () => {},
      renderAsync: () =>
        Promise.resolve({
          saveAsync: () => {
            mockResizeCalls += 1
            return Promise.resolve({ uri: 'file:///cache/thumbs/out.jpg' })
          },
        }),
    }),
  },
}))

import { getThumbnailUri } from '@/lib/image/on-device-resize'

beforeEach(() => {
  mockResizeCalls = 0
  for (const k of Object.keys(mockCache)) delete mockCache[k]
})

it('non-http input returns unchanged, no resize', async () => {
  const r = await getThumbnailUri('some/local/asset', 384)
  expect(r).toBe('some/local/asset')
  expect(mockResizeCalls).toBe(0)
})

it('resizes a remote url and returns a local file', async () => {
  const r = await getThumbnailUri('http://s3/a.jpg', 384)
  expect(r).toBe('file:///cache/thumbs/out.jpg')
  expect(mockResizeCalls).toBe(1)
})

it('cache hit short-circuits (no resize)', async () => {
  mockCache['http://s3/a.jpg'] = 'file:///cache/thumbs/cached.jpg'
  const r = await getThumbnailUri('http://s3/a.jpg', 384)
  expect(r).toBe('file:///cache/thumbs/cached.jpg')
  expect(mockResizeCalls).toBe(0)
})

it('dedupes concurrent calls for the same url', async () => {
  const [a, b] = await Promise.all([
    getThumbnailUri('http://s3/dup.jpg', 384),
    getThumbnailUri('http://s3/dup.jpg', 384),
  ])
  expect(a).toBe(b)
  expect(mockResizeCalls).toBe(1)
})
