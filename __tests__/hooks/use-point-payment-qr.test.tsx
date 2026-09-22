import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

import { getPointPaymentQr, payPointPaymentQr } from '@/api/payment'
import { QUERYKEY } from '@/constants'
import {
  fetchPointPaymentQr,
  pointPaymentQrKey,
  usePayPointPaymentQr,
} from '@/hooks/use-point-payment-qr'

jest.mock('@/api/payment', () => ({
  getPointPaymentQr: jest.fn(),
  payPointPaymentQr: jest.fn(),
}))

const QR = {
  slug: 'q1',
  code: 'c',
  amount: 22400,
  status: 'initiate' as const,
  orderSlug: 'o1',
  createdAt: '2026-09-19T00:00:00Z',
}

let activeQueryClient: QueryClient | undefined

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  activeQueryClient = queryClient
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, invalidate, wrapper }
}

afterEach(() => {
  jest.clearAllMocks()
  activeQueryClient?.clear()
  activeQueryClient = undefined
})

describe('usePayPointPaymentQr', () => {
  it('trả thành công thì làm mới số dư và lịch sử xu', async () => {
    jest.mocked(payPointPaymentQr).mockResolvedValue({ result: QR } as never)
    const { invalidate, wrapper } = setup()
    const { result } = renderHook(() => usePayPointPaymentQr(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('RAW')
    })
    await act(async () => {})

    expect(payPointPaymentQr).toHaveBeenCalledWith('RAW')
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [QUERYKEY.profile, 'balance'],
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [QUERYKEY.pointTransactions],
    })
  })

  it('trả lỗi thì không làm mới gì', async () => {
    jest.mocked(payPointPaymentQr).mockRejectedValue(new Error('x'))
    const { invalidate, wrapper } = setup()
    const { result } = renderHook(() => usePayPointPaymentQr(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('RAW').catch(() => {})
    })
    await act(async () => {})

    expect(invalidate).not.toHaveBeenCalled()
  })
})

describe('fetchPointPaymentQr', () => {
  it('luôn hỏi lại server và để kết quả trong cache cho màn xác nhận', async () => {
    jest.mocked(getPointPaymentQr).mockResolvedValue({ result: QR } as never)
    const { queryClient } = setup()
    queryClient.setQueryData(pointPaymentQrKey('RAW'), {
      ...QR,
      status: 'completed',
    })

    const qr = await fetchPointPaymentQr(queryClient, 'RAW')

    expect(getPointPaymentQr).toHaveBeenCalledWith('RAW')
    expect(qr.status).toBe('initiate')
    expect(queryClient.getQueryData(pointPaymentQrKey('RAW'))).toEqual(QR)
  })
})
