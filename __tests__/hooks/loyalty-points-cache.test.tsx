// Hai hook cùng tên `useLoyaltyPoints` dùng chung query key tổng điểm, cộng
// thêm prefetch ngay sau đăng nhập ở use-post-auth-actions.ts. Ba chỗ ghi phải
// cùng một dạng cache, nếu không màn đọc sau sẽ thấy dạng của màn ghi trước.
// staleTime phải giống app (lib/query-client.ts) — để mặc định 0 thì hook sẽ
// refetch khi mount và che mất lỗi.
import * as fs from 'fs'
import * as path from 'path'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'

import { getLoyaltyPoints } from '@/api/loyalty-point'
import { QUERYKEY } from '@/constants'
import { useLoyaltyPoints as useHub } from '@/hooks/use-loyalty-point'
import { useLoyaltyPoints as useBarrel } from '@/hooks/use-loyalty-points'

const mockGetLoyaltyPoints = jest.fn()

jest.mock('@/api/loyalty-point', () => ({
  getLoyaltyPoints: (...args: unknown[]) => mockGetLoyaltyPoints(...args),
}))

// Hook của hub import từ barrel `@/api`, nên mock cả barrel với cùng hàm.
jest.mock('@/api', () => ({
  getLoyaltyPoints: (...args: unknown[]) => mockGetLoyaltyPoints(...args),
  getLoyaltyPointHistory: jest.fn(),
  applyLoyaltyPoint: jest.fn(),
  cancelReservationForOrder: jest.fn(),
}))

let qc: QueryClient

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockGetLoyaltyPoints.mockResolvedValue({ result: { totalPoints: 1240 } })
  qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  })
})

afterEach(() => {
  jest.clearAllMocks()
  qc.clear()
})

describe('cache tổng điểm tích luỹ', () => {
  it('L1 vừa đăng nhập xong: Profile đọc đúng điểm từ cache prefetch', async () => {
    // Đúng hình dạng prefetch hiện có ở use-post-auth-actions.ts:121
    await qc.prefetchQuery({
      queryKey: [QUERYKEY.loyaltyPoints, 'total', { slug: 'u1' }],
      queryFn: () => getLoyaltyPoints('u1'),
    })
    const { result } = renderHook(() => useBarrel('u1'), { wrapper })
    await waitFor(() => expect(result.current.totalPoints).toBe(1240))
    expect(mockGetLoyaltyPoints).toHaveBeenCalledTimes(1)
  })

  it('L2 Profile rồi tới hub: hub đọc đúng từ cache Profile để lại', async () => {
    const a = renderHook(() => useBarrel('u1'), { wrapper })
    await waitFor(() => expect(a.result.current.totalPoints).toBe(1240))
    const b = renderHook(() => useHub('u1'), { wrapper })
    await waitFor(() => expect(b.result.current.data?.totalPoints).toBe(1240))
    expect(mockGetLoyaltyPoints).toHaveBeenCalledTimes(1)
  })

  it('L3 hub rồi tới Profile: Profile đọc đúng từ cache hub để lại', async () => {
    const a = renderHook(() => useHub('u1'), { wrapper })
    await waitFor(() => expect(a.result.current.data?.totalPoints).toBe(1240))
    const b = renderHook(() => useBarrel('u1'), { wrapper })
    await waitFor(() => expect(b.result.current.totalPoints).toBe(1240))
    expect(mockGetLoyaltyPoints).toHaveBeenCalledTimes(1)
  })

  it('L4 chỉ loyaltyPointsTotalQueryOptions được dựng key tổng điểm', () => {
    // Mỗi chỗ tự dựng key + queryFn là một cơ hội ghi lệch dạng cache. Chỗ
    // thứ tư (prefetch ở thanh tab tự vẽ) đã lọt qua đúng cách đó.
    const root = path.resolve(__dirname, '../..')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (/\.tsx?$/.test(e.name)) {
          const src = fs.readFileSync(full, 'utf-8')
          if (/QUERYKEY\.loyaltyPoints,\s*'total'/.test(src)) {
            offenders.push(path.relative(root, full))
          }
        }
      }
    }
    for (const d of ['app', 'components', 'hooks', 'lib', 'stores']) {
      walk(path.join(root, d))
    }
    expect(offenders).toEqual(['hooks/use-loyalty-point.ts'])
  })
})
