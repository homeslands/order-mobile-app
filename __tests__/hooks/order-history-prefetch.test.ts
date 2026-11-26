// Tải trước trang đầu lịch sử đơn phải ghi đúng khoá mà màn Lịch sử đọc,
// không thì tải thừa một lần mà màn vẫn phải chờ.
import { QueryClient } from '@tanstack/react-query'

import {
  orderHistoryFirstPageQuery,
  ordersQueryOptions,
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
  const key = ordersQueryOptions(orderHistoryFirstPageQuery('u1')).queryKey
  expect(client.getQueryData(key)).toBeDefined()
  expect(mockGetAllOrders).toHaveBeenCalledTimes(1)
})

it('OP2 chưa đăng nhập: không tải', async () => {
  const client = new QueryClient()
  clients.push(client)
  await prefetchOrderHistory(client, undefined)
  expect(mockGetAllOrders).not.toHaveBeenCalled()
})
