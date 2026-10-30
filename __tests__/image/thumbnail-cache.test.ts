const mockStore = new Map<string, string>()
const mockSet = jest.fn((k: string, v: string) => void mockStore.set(k, v))
jest.mock('@/utils/storage', () => ({
  getMMKV: () => ({
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => mockSet(k, v),
    remove: (k: string) => mockStore.delete(k),
  }),
}))
let mockAppStateHandler: ((s: string) => void) | null = null
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, h: (s: string) => void) => {
      mockAppStateHandler = h
      return { remove: () => {} }
    },
  },
}))
const mockDeleted: string[] = []
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: (uri: string) => {
    mockDeleted.push(uri)
    return Promise.resolve()
  },
}))
jest.mock('@/lib/image/resize-config', () => ({
  THUMBNAIL_CACHE_MAX: 3,
  THUMBNAIL_INDEX_PERSIST_MS: 1000,
}))

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
  mockSet.mockClear()
  mockAppStateHandler = null
})

afterEach(() => {
  jest.useRealTimers()
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

// Ghi chỉ mục xuống MMKV là JSON.stringify cả chỉ mục, đồng bộ trên JS thread.
// Ghi sau MỖI ảnh nghĩa là làm việc đó đúng lúc khách đang cuộn.
describe('ghi chỉ mục gộp', () => {
  it('TC6 nhiều lần put chỉ ghi một lần sau khoảng chờ', () => {
    jest.useFakeTimers()
    const { putCachedThumbnail } = loadMod()
    putCachedThumbnail('u1', 384, 'file://1')
    putCachedThumbnail('u2', 384, 'file://2')
    putCachedThumbnail('u3', 384, 'file://3')
    expect(mockSet).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1000)
    expect(mockSet).toHaveBeenCalledTimes(1)
    const saved = JSON.parse(mockSet.mock.calls[0][1]) as Record<
      string,
      unknown
    >
    expect(Object.keys(saved)).toHaveLength(3)
  })

  it('TC7 flushThumbnailIndex ghi ngay, timer sau đó không ghi thêm', () => {
    jest.useFakeTimers()
    const { putCachedThumbnail, flushThumbnailIndex } = loadMod()
    putCachedThumbnail('u1', 384, 'file://1')
    flushThumbnailIndex()
    expect(mockSet).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(5000)
    expect(mockSet).toHaveBeenCalledTimes(1)
  })

  it('TC8 app xuống nền thì ghi ngay', () => {
    jest.useFakeTimers()
    const { putCachedThumbnail } = loadMod()
    putCachedThumbnail('u1', 384, 'file://1')
    expect(mockAppStateHandler).not.toBeNull()
    mockAppStateHandler?.('background')
    expect(mockSet).toHaveBeenCalledTimes(1)
  })

  it('TC9 đọc ngay sau put (chưa ghi đĩa) vẫn thấy mục mới', () => {
    jest.useFakeTimers()
    const { putCachedThumbnail, getCachedThumbnail } = loadMod()
    putCachedThumbnail('u1', 384, 'file://1')
    expect(getCachedThumbnail('u1', 384)).toBe('file://1')
  })

  it('TC10 warmThumbnailIndex nạp chỉ mục đã lưu vào bộ nhớ', () => {
    const mod = loadMod()
    const key = mod.thumbnailKey('u1', 384)
    mockStore.set(
      'thumb-index-v1',
      JSON.stringify({ [key]: { uri: 'file://saved', ts: 1 } }),
    )
    mod.warmThumbnailIndex()
    // Đĩa trống đi sau khi nạp: lần đọc sau phải đến từ bộ nhớ.
    mockStore.clear()
    expect(mod.getCachedThumbnail('u1', 384)).toBe('file://saved')
  })
})
