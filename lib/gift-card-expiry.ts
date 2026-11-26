/**
 * Mua thẻ quà: xử lý lúc đồng hồ thanh toán 15 phút (tính trên máy) về 0.
 *
 * Hỏi lại server trước khi huỷ: khách có thể vừa chuyển khoản và ngân hàng
 * đang xử lý. Chỉ huỷ khi server xác nhận đơn vẫn đang chờ; không hỏi được
 * (mất mạng) thì để server tự xử lý hết hạn.
 */
import { CardOrderStatus } from '@/constants'

export type CardOrderExpiryResult = 'paid' | 'cancelled' | 'unknown'

interface RefetchResult {
  data?: { paymentStatus?: string } | undefined
}

export async function handleCardOrderExpiry({
  refetch,
  cancel,
}: {
  refetch: () => Promise<RefetchResult>
  cancel: () => void
}): Promise<CardOrderExpiryResult> {
  let status: string | undefined
  try {
    status = (await refetch()).data?.paymentStatus
  } catch {
    return 'unknown'
  }
  if (status === CardOrderStatus.COMPLETED) return 'paid'
  if (status === CardOrderStatus.PENDING) {
    cancel()
    return 'cancelled'
  }
  // Đã huỷ / thất bại sẵn: không gọi huỷ lần nữa. Không có dữ liệu: không đoán.
  return status ? 'cancelled' : 'unknown'
}
