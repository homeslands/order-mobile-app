const mockStore = new Map<string, string>()
jest.mock('@/utils/storage', () => ({
  getMMKV: () => ({
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => void mockStore.set(k, v),
    remove: (k: string) => mockStore.delete(k),
  }),
}))
const mockDeleted: string[] = []
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: (uri: string) => {
    mockDeleted.push(uri)
    return Promise.resolve()
  },
}))
jest.mock('@/lib/image/resize-config', () => ({ THUMBNAIL_CACHE_MAX: 3 }))

type CacheMod = typeof import('@/lib/image/thumbnail-cache')

function loadMod(): CacheMod {
  let mod: CacheMod | null = null
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/image/thumbnail-cache') as CacheMod
  })
  if (!mod) throw new Error('module did not load')
  return mod
}

beforeEach(() => {
  mockStore.clear()
  mockDeleted.length = 0
})

it('key differs by url and width', () => {
  const { thumbnailKey } = loadMod()
  expect(thumbnailKey('a', 384)).not.toBe(thumbnailKey('b', 384))
  expect(thumbnailKey('a', 384)).not.toBe(thumbnailKey('a', 768))
  expect(thumbnailKey('a', 384)).toBe(thumbnailKey('a', 384))
})

it('put then get round-trips', () => {
  const { putCachedThumbnail, getCachedThumbnail } = loadMod()
  putCachedThumbnail('http://x/a.jpg', 384, 'file://thumb-a.jpg')
  expect(getCachedThumbnail('http://x/a.jpg', 384)).toBe('file://thumb-a.jpg')
})

it('miss returns null', () => {
  const { getCachedThumbnail } = loadMod()
  expect(getCachedThumbnail('http://x/none.jpg', 384)).toBeNull()
})

it('evicts oldest-inserted file when over cap', () => {
  const { putCachedThumbnail, getCachedThumbnail } = loadMod()
  putCachedThumbnail('u1', 384, 'file://1')
  putCachedThumbnail('u2', 384, 'file://2')
  putCachedThumbnail('u3', 384, 'file://3')
  putCachedThumbnail('u4', 384, 'file://4') // over cap (3) -> evict oldest (u1)
  expect(getCachedThumbnail('u1', 384)).toBeNull()
  expect(mockDeleted).toContain('file://1')
  expect(getCachedThumbnail('u4', 384)).toBe('file://4')
})

it('invalidate removes entry and deletes file', () => {
  const { putCachedThumbnail, invalidateThumbnail, getCachedThumbnail } =
    loadMod()
  putCachedThumbnail('u1', 384, 'file://1')
  invalidateThumbnail('u1', 384)
  expect(getCachedThumbnail('u1', 384)).toBeNull()
  expect(mockDeleted).toContain('file://1')
})
