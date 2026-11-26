// Menu tải lỗi từng hiện như "chưa có món" vì hook không báo lỗi. Hook phải
// báo isError cho lỗi thật, nhưng KHÔNG cho 117002 (danh mục rỗng hôm nay).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { useCatalogMenuPages } from '@/hooks/use-catalog-menu-pages'

const mockFetch = jest.fn()

jest.mock('@/api/menu', () => ({
  extractMenuItems: (r: unknown) => (Array.isArray(r) ? r : []),
  getSpecificMenu: (q: unknown) => mockFetch(q),
  getPublicSpecificMenu: (q: unknown) => mockFetch(q),
}))

function renderPages() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(
    () =>
      useCatalogMenuPages({
        catalogSlugs: ['coffee', 'tea'],
        request: { branch: 'b1' } as never,
        hasUser: false,
        enabled: true,
        batch: 5,
      }),
    { wrapper },
  )
}

beforeEach(() => mockFetch.mockReset())

it('lỗi mạng ở một danh mục thì isError', async () => {
  mockFetch.mockImplementation((q: { catalog: string }) =>
    q.catalog === 'tea'
      ? Promise.reject(new Error('Network Error'))
      : Promise.resolve({ result: [] }),
  )
  const { result } = renderPages()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await waitFor(() => expect(result.current.isError).toBe(true))
})

it('117002 (danh mục không có món) không tính là lỗi', async () => {
  mockFetch.mockRejectedValue({ response: { data: { statusCode: 117002 } } })
  const { result } = renderPages()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.isError).toBe(false)
})
