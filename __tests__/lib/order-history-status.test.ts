// Nhãn trạng thái trên thẻ Lịch sử đơn: trước đây chỉ hai màu theo thanh toán
// (đơn thất bại cũng vàng "Chưa thanh toán"). Giờ theo trạng thái đơn.
import { getOrderHistoryStatus } from '@/lib/order-history-status'
import { paymentStatus } from '@/constants'
import { OrderStatus } from '@/types'

const order = (status: string, pay?: string) => ({
  status,
  payment: pay ? { statusCode: pay } : undefined,
})

it('ST1 thất bại thắng mọi thứ', () => {
  expect(
    getOrderHistoryStatus(order(OrderStatus.FAILED, paymentStatus.COMPLETED)),
  ).toBe('failed')
})

it('ST2 hoàn tất', () => {
  expect(
    getOrderHistoryStatus(
      order(OrderStatus.COMPLETED, paymentStatus.COMPLETED),
    ),
  ).toBe('completed')
})

it('ST3 đã thanh toán, quán đang làm / đang giao', () => {
  expect(
    getOrderHistoryStatus(order(OrderStatus.PAID, paymentStatus.COMPLETED)),
  ).toBe('paid')
  expect(
    getOrderHistoryStatus(order(OrderStatus.SHIPPING, paymentStatus.COMPLETED)),
  ).toBe('paid')
})

it('ST4 chưa thanh toán', () => {
  expect(getOrderHistoryStatus(order(OrderStatus.PENDING))).toBe('unpaid')
  expect(
    getOrderHistoryStatus(order(OrderStatus.PENDING, paymentStatus.PENDING)),
  ).toBe('unpaid')
})
