// Tải trước Menu từ Home từng bị gỡ vì ghi vào khoá mà màn Menu không đọc.
// Giờ Home và Menu dùng chung một nơi dựng tham số và cấu hình truy vấn: dữ
// liệu tải trước phải nằm ĐÚNG khoá Menu sẽ đọc.
import { QueryClient } from '@tanstack/react-query'

import type { IMenuFilter } from '@/types'
import {
  catalogMenuQueryOptions,
  menuRequestForFilter,
  prefetchMenu,
} from '@/lib/menu-queries'

const mockGetCatalog = jest.fn(async () => ({
  result: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((slug) => ({
    slug,
    name: slug,
  })),
}))
const mockMenu = jest.fn(async () => ({ result: { items: [] } }))
const mockBranches = jest.fn(async () => ({ result: [] }))
jest.mock('@/api', () => ({
  getCatalog: () => mockGetCatalog(),
  getAllBranches: () => mockBranches(),
}))
jest.mock('@/api/menu', () => ({
  ...jest.requireActual<typeof import('@/api/menu')>('@/api/menu'),
  getPublicSpecificMenu: (...a: unknown[]) => mockMenu(...(a as [])),
  getSpecificMenu: (...a: unknown[]) => mockMenu(...(a as [])),
}))

const clients: QueryClient[] = []
function newClient() {
  const c = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  })
  clients.push(c)
  return c
}

const filter = { date: undefined } as unknown as IMenuFilter

beforeEach(() => {
  mockGetCatalog.mockClear()
  mockMenu.mockClear()
  mockBranches.mockClear()
})

afterEach(() => {
  clients.splice(0).forEach((c) => c.clear())
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('MQ1 tải trước đúng khoá Menu đọc: đợt 5 danh mục đầu', async () => {
  const client = newClient()
  await prefetchMenu(client, {
    hasUser: false,
    branchSlug: 'b1',
    menuFilter: filter,
  })

  const request = menuRequestForFilter(filter, 'b1')
  for (const slug of ['c1', 'c2', 'c3', 'c4', 'c5']) {
    const key = catalogMenuQueryOptions(false, request, slug).queryKey
    expect(client.getQueryData(key)).toBeDefined()
  }
  const sixth = catalogMenuQueryOptions(false, request, 'c6').queryKey
  expect(client.getQueryData(sixth)).toBeUndefined()
  expect(mockMenu).toHaveBeenCalledTimes(5)
})

it('MQ2 chưa có chi nhánh: chỉ tải trước danh sách chi nhánh, không tải menu', async () => {
  const client = newClient()
  await prefetchMenu(client, {
    hasUser: false,
    branchSlug: undefined,
    menuFilter: filter,
  })
  expect(mockMenu).not.toHaveBeenCalled()
  expect(mockBranches).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(['branches'])).toBeDefined()
})

it('MQ3 đang lọc Bán chạy / Mới (Menu dùng đường khác): không tải', async () => {
  const client = newClient()
  await prefetchMenu(client, {
    hasUser: false,
    branchSlug: 'b1',
    menuFilter: { ...filter, isTopSell: true } as IMenuFilter,
  })
  expect(mockMenu).not.toHaveBeenCalled()
})

it('MQ4 khách đã đăng nhập và khách vãng lai dùng khoá khác nhau', () => {
  const request = menuRequestForFilter(filter, 'b1')
  expect(catalogMenuQueryOptions(true, request, 'c1').queryKey[0]).toBe(
    'specific-menu',
  )
  expect(catalogMenuQueryOptions(false, request, 'c1').queryKey[0]).toBe(
    'public-specific-menu',
  )
})
