let mockResizeCalls = 0
jest.mock('@/lib/image/resize-config', () => ({
  ON_DEVICE_RESIZE_ENABLED: true,
  RESIZE_CONCURRENCY: 2,
  THUMBNAIL_JPEG_COMPRESS: 0.8,
  THUMBNAIL_AHEAD_MAX: 16,
}))
jest.mock('@/utils/product-image-url', () => ({ RESIZE_SERVICE_READY: false }))

// Khi mockHold bật, mỗi lần tải giữ lại tới khi test gọi release(url) — để
// quan sát THỨ TỰ hàng đợi cấp slot.
let mockHold = false
const mockDownloads: string[] = []
const mockPending = new Map<string, () => void>()
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
  downloadAsync: (url: string, to: string) => {
    mockDownloads.push(url)
    if (!mockHold) return Promise.resolve({ uri: to })
    return new Promise((res) => mockPending.set(url, () => res({ uri: to })))
  },
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

import {
  getThumbnailUri,
  prefetchThumbnails,
} from '@/lib/image/on-device-resize'

const flush = () => new Promise((r) => setImmediate(r))

async function release(url: string) {
  const done = mockPending.get(url)
  if (!done) throw new Error(`no pending download for ${url}`)
  mockPending.delete(url)
  done()
  await flush()
}

async function releaseAll() {
  while (mockPending.size > 0) {
    await release([...mockPending.keys()][0])
  }
}

beforeEach(async () => {
  // Giải phóng mọi việc treo của test trước để hàng đợi mức module sạch slot.
  await releaseAll()
  mockHold = false
  mockResizeCalls = 0
  mockDownloads.length = 0
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

// Hai slot (RESIZE_CONCURRENCY: 2 trong mock). Chiếm cả hai rồi xếp hàng.
async function fillSlots(prefix: string) {
  mockHold = true
  const a = getThumbnailUri(`http://s3/${prefix}-busy1.jpg`, 384)
  const b = getThumbnailUri(`http://s3/${prefix}-busy2.jpg`, 384)
  await flush()
  return { a, b }
}

describe('hàng đợi có ưu tiên', () => {
  it('R5 ô hiện ở lượt sau được làm trước (lượt mới nhất trước)', async () => {
    await fillSlots('r5')
    void getThumbnailUri('http://s3/r5-u3.jpg', 384)
    await flush()
    void getThumbnailUri('http://s3/r5-u4.jpg', 384)
    await flush()
    await release('http://s3/r5-busy1.jpg')
    expect(mockDownloads[2]).toBe('http://s3/r5-u4.jpg')
  })

  it('R6 một người huỷ, người còn lại vẫn nhận thumbnail', async () => {
    await fillSlots('r6')
    const ac = new AbortController()
    const p1 = getThumbnailUri('http://s3/r6-u5.jpg', 384, {
      signal: ac.signal,
    })
    const p2 = getThumbnailUri('http://s3/r6-u5.jpg', 384)
    ac.abort()
    await flush()
    await releaseAll()
    await releaseAll()
    expect(mockDownloads).toContain('http://s3/r6-u5.jpg')
    await expect(p2).resolves.toBe('file:///cache/thumbs/out.jpg')
    await expect(p1).resolves.toBeDefined()
  })

  it('R7 huỷ khi còn chờ thì không tải và trả lại URL gốc', async () => {
    await fillSlots('r7')
    const ac = new AbortController()
    const p = getThumbnailUri('http://s3/r7-u6.jpg', 384, { signal: ac.signal })
    await flush()
    ac.abort()
    await expect(p).resolves.toBe('http://s3/r7-u6.jpg')
    await releaseAll()
    await releaseAll()
    expect(mockDownloads).not.toContain('http://s3/r7-u6.jpg')
  })

  it('R8 việc tải trước nhường ô đang hiện', async () => {
    await fillSlots('r8')
    prefetchThumbnails(['http://s3/r8-u7.jpg'], 384)
    void getThumbnailUri('http://s3/r8-u8.jpg', 384)
    await flush()
    await release('http://s3/r8-busy1.jpg')
    expect(mockDownloads[2]).toBe('http://s3/r8-u8.jpg')
  })

  it('R9 tải trước tối đa 16 việc chờ, bỏ món xa nhất', async () => {
    await fillSlots('r9')
    const urls = Array.from({ length: 20 }, (_, i) => `http://s3/r9-p${i}.jpg`)
    prefetchThumbnails(urls, 384)
    await flush()
    for (let i = 0; i < 30; i += 1) await releaseAll()
    const prefetched = mockDownloads.filter((u) => u.includes('r9-p'))
    expect(prefetched).toHaveLength(16)
    expect(prefetched).toContain('http://s3/r9-p0.jpg')
    expect(prefetched).not.toContain('http://s3/r9-p19.jpg')
  })

  it('R11 trong cùng một lượt (cùng commit), ô trên làm trước ô dưới', async () => {
    await fillSlots('r11')
    // FlashList mount các ô từ trên xuống trong một commit: effect của chúng
    // chạy liền nhau trong cùng một tick.
    for (const n of [1, 2, 3, 4]) {
      void getThumbnailUri(`http://s3/r11-row${n}.jpg`, 384)
    }
    await flush()
    await release('http://s3/r11-busy1.jpg')
    await release('http://s3/r11-busy2.jpg')
    expect(mockDownloads.slice(2, 4)).toEqual([
      'http://s3/r11-row1.jpg',
      'http://s3/r11-row2.jpg',
    ])
  })

  it('R12 tải trước đi từ món gần nhất', async () => {
    await fillSlots('r12')
    prefetchThumbnails(
      [
        'http://s3/r12-near.jpg',
        'http://s3/r12-mid.jpg',
        'http://s3/r12-far.jpg',
      ],
      384,
    )
    await flush()
    await release('http://s3/r12-busy1.jpg')
    expect(mockDownloads[2]).toBe('http://s3/r12-near.jpg')
  })

  it('R10 server đã resize thì trả nguyên URL, không tải', async () => {
    // Lấy đúng object module (import * tạo bản sao qua interop của Babel).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const productImageUrl = require('@/utils/product-image-url') as {
      RESIZE_SERVICE_READY: boolean
    }
    jest.replaceProperty(productImageUrl, 'RESIZE_SERVICE_READY', true)
    const r = await getThumbnailUri('http://s3/r10.jpg', 384)
    expect(r).toBe('http://s3/r10.jpg')
    expect(mockDownloads).not.toContain('http://s3/r10.jpg')
    jest.restoreAllMocks()
  })
})
