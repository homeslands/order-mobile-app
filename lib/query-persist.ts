/**
 * Lưu cache Menu xuống máy (MMKV) để mở app là có menu ngay.
 *
 * Chỉ lưu chi nhánh, danh mục và menu theo danh mục — dữ liệu chung, đổi ít;
 * không lưu dữ liệu cá nhân (số dư, đơn, hồ sơ). Mở app: nạp lại, giữ nguyên
 * thời điểm cập nhật, nên React Query vẫn coi phần đã cũ là cũ và làm mới
 * ngầm khi màn cần (Menu: useEntryFetchGate). Giá vẫn được giỏ kiểm lại khi
 * đặt. Quá MAX_AGE_MS thì bỏ hẳn, tránh hiện thực đơn quá xưa.
 */
import {
  dehydrate,
  hydrate,
  type Query,
  type QueryClient,
} from '@tanstack/react-query'

export const QUERY_CACHE_STORAGE_KEY = 'rq-menu-cache-v1'
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

const PERSISTED_ROOTS = new Set([
  'branches',
  'catalog',
  'specific-menu',
  'public-specific-menu',
])

export interface CacheStorage {
  getString: (key: string) => string | undefined
  set: (key: string, value: string) => void
  remove: (key: string) => boolean | void
}

/** Gốc của query key; QUERYKEY.catalog là mảng nên khoá có dạng [['catalog']]. */
function keyRoot(queryKey: readonly unknown[]): string {
  const first = queryKey[0]
  return String(Array.isArray(first) ? first[0] : first)
}

function shouldPersist(query: Query): boolean {
  return (
    query.state.status === 'success' &&
    PERSISTED_ROOTS.has(keyRoot(query.queryKey))
  )
}

export function persistQueryCache(
  client: QueryClient,
  storage: CacheStorage,
  now: number = Date.now(),
): void {
  try {
    const state = dehydrate(client, { shouldDehydrateQuery: shouldPersist })
    storage.set(
      QUERY_CACHE_STORAGE_KEY,
      JSON.stringify({ savedAt: now, state }),
    )
  } catch {
    // Ghi hỏng thì lần sau tải từ mạng như cũ — không đáng làm phiền khách.
  }
}

/** Trả true nếu đã nạp lại dữ liệu. */
export function restoreQueryCache(
  client: QueryClient,
  storage: CacheStorage,
  now: number = Date.now(),
): boolean {
  const raw = storage.getString(QUERY_CACHE_STORAGE_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown; state?: unknown }
    if (typeof parsed.savedAt !== 'number' || !parsed.state) {
      throw new Error('invalid')
    }
    if (now - parsed.savedAt > MAX_AGE_MS) {
      storage.remove(QUERY_CACHE_STORAGE_KEY)
      return false
    }
    hydrate(client, parsed.state)
    return true
  } catch {
    storage.remove(QUERY_CACHE_STORAGE_KEY)
    return false
  }
}

/**
 * Lưu lại (gộp trong `debounceMs`) mỗi khi một query cần lưu có dữ liệu mới.
 * Trả hàm huỷ theo dõi.
 */
export function startQueryCachePersistence(
  client: QueryClient,
  storage: CacheStorage,
  debounceMs = 1500,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return
    if (!PERSISTED_ROOTS.has(keyRoot(event.query.queryKey as unknown[]))) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      persistQueryCache(client, storage)
    }, debounceMs)
  })
  return () => {
    if (timer) clearTimeout(timer)
    unsubscribe()
  }
}
