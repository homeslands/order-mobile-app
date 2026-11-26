// Tiền phải trả khi sửa đơn — một chỗ tính cho thanh dưới và sheet xác nhận.
// Trước hai chỗ ra hai số: đổi giao hàng → mang đi vẫn cộng phí ship cũ, đổi
// địa chỉ thì sheet xác nhận vẫn lấy phí cũ; giá gạch ngang là tổng TRƯỚC
// khuyến mãi.
import { OrderTypeEnum } from '@/types'
import { computeUpdateOrderPayable } from '@/utils/update-order-payable'

const totals = {
  subTotalBeforeDiscount: 100000,
  promotionDiscount: 20000,
  voucherDiscount: 10000,
  finalTotal: 70000,
}

it('UP1 không phải giao hàng thì không có phí ship (kể cả đơn gốc là giao)', () => {
  const p = computeUpdateOrderPayable({
    cartTotals: totals,
    type: OrderTypeEnum.TAKE_OUT,
    deliveryDistance: 3,
    recalculatedDeliveryFee: 15000,
    originalDeliveryFee: 12000,
    pointsUsed: 0,
  })
  expect(p.deliveryFee).toBe(0)
  expect(p.finalTotal).toBe(70000)
})

it('UP2 giao hàng: dùng phí tính lại theo địa chỉ mới, chưa có thì phí cũ', () => {
  const base = {
    cartTotals: totals,
    type: OrderTypeEnum.DELIVERY,
    deliveryDistance: 3,
    originalDeliveryFee: 12000,
    pointsUsed: 0,
  }
  expect(
    computeUpdateOrderPayable({ ...base, recalculatedDeliveryFee: 15000 })
      .finalTotal,
  ).toBe(85000)
  expect(
    computeUpdateOrderPayable({ ...base, recalculatedDeliveryFee: undefined })
      .deliveryFee,
  ).toBe(12000)
})

it('UP3 trừ điểm đã dùng; giá gạch ngang là tổng SAU khuyến mãi, trước voucher', () => {
  const p = computeUpdateOrderPayable({
    cartTotals: totals,
    type: OrderTypeEnum.AT_TABLE,
    deliveryDistance: 0,
    recalculatedDeliveryFee: undefined,
    originalDeliveryFee: 0,
    pointsUsed: 5000,
  })
  expect(p.finalTotal).toBe(65000)
  expect(p.totalBeforeVoucher).toBe(75000)
  expect(p.voucherDiscount).toBe(10000)
})

it('UP4 chưa có tổng (bản nháp chưa sẵn) thì 0', () => {
  const p = computeUpdateOrderPayable({
    cartTotals: null,
    type: OrderTypeEnum.AT_TABLE,
    deliveryDistance: 0,
    recalculatedDeliveryFee: undefined,
    originalDeliveryFee: 0,
    pointsUsed: 0,
  })
  expect(p.finalTotal).toBe(0)
})
