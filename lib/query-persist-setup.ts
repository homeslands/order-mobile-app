/**
 * Nạp lại cache Menu đã lưu (chi nhánh, danh mục, menu) ngay khi app khởi động,
 * rồi tự lưu khi có dữ liệu mới. Import một lần ở app/_layout.tsx, trước khi
 * cây React render, để màn đầu tiên đọc được dữ liệu đã nạp.
 *
 * Web / không có MMKV: không làm gì.
 */
import { queryClient } from '@/lib/query-client'
import {
  restoreQueryCache,
  startQueryCachePersistence,
} from '@/lib/query-persist'
import { getMMKV } from '@/utils/storage'

const storage = getMMKV()
if (storage) {
  restoreQueryCache(queryClient, storage)
  startQueryCachePersistence(queryClient, storage)
}
