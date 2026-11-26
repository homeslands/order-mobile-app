/**
 * Trạng thái hiển thị trên thẻ Lịch sử đơn — gộp trạng thái đơn và thanh
 * toán thành bốn mức khách hiểu được: thất bại, hoàn tất, đã thanh toán (quán
 * đang làm / đang giao), chưa thanh toán.
 */
import { paymentStatus } from '@/constants/payment.constant'
import { OrderStatus } from '@/types'

export type OrderHistoryStatus = 'failed' | 'completed' | 'paid' | 'unpaid'

export function getOrderHistoryStatus(order: {
  status?: string
  payment?: { statusCode?: string } | null
}): OrderHistoryStatus {
  if (order.status === OrderStatus.FAILED) return 'failed'
  if (order.status === OrderStatus.COMPLETED) return 'completed'
  if (order.payment?.statusCode === paymentStatus.COMPLETED) return 'paid'
  return 'unpaid'
}
