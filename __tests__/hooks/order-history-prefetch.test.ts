// Tải trước trang đầu lịch sử đơn phải ghi đúng khoá mà màn Lịch sử đọc,
// không thì tải thừa một lần mà màn vẫn phải chờ.
import { QueryClient } from '@tanstack/react-query'

import {
  orderHistoryInfiniteOptions,
  orderHistoryQuery,
  prefetchOrderHistory,
} from '@/hooks/use-order'

const mockGetAllOrders = jest.fn(async () => ({ result: { items: [] } }))
jest.mock('@/api', () => ({
  getAllOrders: (...a: unknown[]) => mockGetAllOrders(...(a as [])),
}))

const clients: QueryClient[] = []
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear())
  mockGetAllOrders.mockClear()
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('OP1 tải trước ghi đúng khoá màn Lịch sử đọc (lọc Tất cả, trang 1)', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  })
  clients.push(client)
  await prefetchOrderHistory(client, 'u1')
  // Màn Lịch sử cuộn tải thêm (useInfiniteQuery) — tải trước phải ghi đúng
  // khoá infinite, lọc "Tất cả", chưa lọc ngày.
  const key = orderHistoryInfiniteOptions(orderHistoryQuery('u1', {})).queryKey
  const data = client.getQueryData<{ pages: unknown[] }>(key)
  expect(data?.pages).toHaveLength(1)
  expect(mockGetAllOrders).toHaveBeenCalledWith(
    expect.objectContaining({ page: 1, owner: 'u1', order: 'DESC' }),
  )
})

it('OP2 chưa đăng nhập: không tải', async () => {
  const client = new QueryClient()
  clients.push(client)
  await prefetchOrderHistory(client, undefined)
  expect(mockGetAllOrders).not.toHaveBeenCalled()
})

it('OP3 trang sau: có hasNext thì xin trang kế, hết thì dừng', () => {
  const opts = orderHistoryInfiniteOptions(orderHistoryQuery('u1', {}))
  expect(
    opts.getNextPageParam({ result: { hasNext: true, page: 2 } } as never),
  ).toBe(3)
  expect(
    opts.getNextPageParam({ result: { hasNext: false, page: 3 } } as never),
  ).toBeUndefined()
})
