// Mua thẻ quà: đồng hồ 15 phút (tính trên máy) về 0 thì app từng gọi huỷ đơn
// ngay, kể cả khi khách vừa chuyển khoản và ngân hàng đang xử lý. Giờ hỏi lại
// server trước: đã trả thì không huỷ; không hỏi được thì cũng không huỷ, để
// server tự xử lý hết hạn.
import { CardOrderStatus } from '@/constants'
import { handleCardOrderExpiry } from '@/lib/gift-card-expiry'

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('GE1 server báo đã trả: không huỷ', async () => {
  const cancel = jest.fn()
  const result = await handleCardOrderExpiry({
    refetch: async () => ({
      data: { paymentStatus: CardOrderStatus.COMPLETED },
    }),
    cancel,
  })
  expect(cancel).not.toHaveBeenCalled()
  expect(result).toBe('paid')
})

it('GE2 server báo chưa trả: huỷ', async () => {
  const cancel = jest.fn()
  const result = await handleCardOrderExpiry({
    refetch: async () => ({ data: { paymentStatus: CardOrderStatus.PENDING } }),
    cancel,
  })
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(result).toBe('cancelled')
})

it('GE3 không hỏi được server (mất mạng): không huỷ', async () => {
  const cancel = jest.fn()
  const result = await handleCardOrderExpiry({
    refetch: async () => {
      throw new Error('Network Error')
    },
    cancel,
  })
  expect(cancel).not.toHaveBeenCalled()
  expect(result).toBe('unknown')
})

it('GE4 refetch trả lỗi mà không ném (react-query): không huỷ', async () => {
  const cancel = jest.fn()
  const result = await handleCardOrderExpiry({
    refetch: async () => ({ data: undefined, isError: true }),
    cancel,
  })
  expect(cancel).not.toHaveBeenCalled()
  expect(result).toBe('unknown')
})
