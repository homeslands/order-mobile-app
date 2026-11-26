// Menu chỉ nằm trong bộ nhớ: mỗi lần mở app tải lại chi nhánh → danh mục →
// món. Giờ lưu đúng mấy query đó xuống máy; mở app nạp lại để Menu hiện ngay,
// React Query tự làm mới phần đã cũ. Dữ liệu quá 3 ngày thì bỏ.
import { QueryClient } from '@tanstack/react-query'

import {
  QUERY_CACHE_STORAGE_KEY,
  persistQueryCache,
  restoreQueryCache,
  startQueryCachePersistence,
} from '@/lib/query-persist'

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    map: m,
    getString: (k: string) => m.get(k),
    set: (k: string, v: string) => {
      m.set(k, v)
    },
    remove: (k: string) => m.delete(k),
  }
}

const DAY = 24 * 60 * 60 * 1000

// gcTime vô hạn: không để lại hẹn giờ dọn cache làm Jest không thoát.
const clients: QueryClient[] = []
function newClient() {
  const c = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  })
  clients.push(c)
  return c
}

afterEach(() => {
  clients.splice(0).forEach((c) => c.clear())
  jest.useRealTimers()
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('QP1 chỉ lưu chi nhánh, danh mục, menu — không lưu thứ khác', () => {
  const client = newClient()
  const storage = memoryStorage()
  client.setQueryData(['branches'], { result: ['b1'] })
  client.setQueryData([['catalog']], { result: ['c1'] })
  client.setQueryData(['public-specific-menu', { catalog: 'c1' }], { m: 1 })
  client.setQueryData(['specific-menu', { catalog: 'c1' }], { m: 2 })
  client.setQueryData(['banners'], { result: [] })
  client.setQueryData(['profile', 'balance'], { points: 9 })

  persistQueryCache(client, storage, 1000)
  const saved = JSON.parse(storage.map.get(QUERY_CACHE_STORAGE_KEY)!) as {
    savedAt: number
    state: { queries: { queryKey: unknown[] }[] }
  }
  const roots = saved.state.queries.map((q) => JSON.stringify(q.queryKey[0]))
  expect(saved.savedAt).toBe(1000)
  expect(roots.sort()).toEqual(
    [
      '"branches"',
      '["catalog"]',
      '"public-specific-menu"',
      '"specific-menu"',
    ].sort(),
  )
})

it('QP2 mở app: nạp lại dữ liệu đã lưu, giữ nguyên thời điểm cập nhật', () => {
  const storage = memoryStorage()
  const a = newClient()
  a.setQueryData(['branches'], { result: ['b1'] }, { updatedAt: 5000 })
  persistQueryCache(a, storage, 6000)

  const b = newClient()
  expect(restoreQueryCache(b, storage, 6000 + DAY)).toBe(true)
  expect(b.getQueryData(['branches'])).toEqual({ result: ['b1'] })
  expect(b.getQueryState(['branches'])?.dataUpdatedAt).toBe(5000)
})

it('QP3 dữ liệu quá 3 ngày: không nạp, xoá khỏi máy', () => {
  const storage = memoryStorage()
  const a = newClient()
  a.setQueryData(['branches'], { result: ['b1'] })
  persistQueryCache(a, storage, 0)

  const b = newClient()
  expect(restoreQueryCache(b, storage, 3 * DAY + 1)).toBe(false)
  expect(b.getQueryData(['branches'])).toBeUndefined()
  expect(storage.map.has(QUERY_CACHE_STORAGE_KEY)).toBe(false)
})

it('QP4 dữ liệu hỏng: bỏ qua, không làm sập app', () => {
  const storage = memoryStorage()
  storage.set(QUERY_CACHE_STORAGE_KEY, '{not json')
  const b = newClient()
  expect(() => restoreQueryCache(b, storage, 0)).not.toThrow()
  expect(storage.map.has(QUERY_CACHE_STORAGE_KEY)).toBe(false)
})

it('QP5 tự lưu (gộp nhiều lần cập nhật) khi query cần lưu có dữ liệu mới', () => {
  jest.useFakeTimers()
  const client = newClient()
  const storage = memoryStorage()
  const stop = startQueryCachePersistence(client, storage, 1000)

  client.setQueryData(['banners'], { result: [] })
  jest.advanceTimersByTime(1500)
  expect(storage.map.has(QUERY_CACHE_STORAGE_KEY)).toBe(false)

  client.setQueryData(['branches'], { result: ['b1'] })
  client.setQueryData([['catalog']], { result: ['c1'] })
  expect(storage.map.has(QUERY_CACHE_STORAGE_KEY)).toBe(false)
  jest.advanceTimersByTime(1000)
  expect(storage.map.has(QUERY_CACHE_STORAGE_KEY)).toBe(true)
  stop()
})
