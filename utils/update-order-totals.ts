/**
 * Tổng tiền bản nháp sửa đơn — nhớ kết quả theo tham chiếu món + voucher.
 *
 * 4 chỗ dùng (danh sách món, thanh dưới, sheet xác nhận, sheet voucher) trước
 * mỗi chỗ tự useMemo theo cả bản nháp: đổi ghi chú / loại đơn / bàn cũng tính
 * lại 4 lần. Giờ một kết quả dùng chung, chỉ tính lại khi món hay voucher đổi.
 */
import type { IOrderItem, IVoucher } from '@/types'

import {
  calculateOrderDisplayAndTotals,
  transformOrderItemToOrderDetail,
} from './cart'

type Totals = ReturnType<typeof calculateOrderDisplayAndTotals>

export type UpdateOrderTotals = {
  displayItems: Totals['displayItems']
  cartTotals: Totals['cartTotals'] | null
}

const EMPTY: UpdateOrderTotals = { displayItems: [], cartTotals: null }

let lastItems: IOrderItem[] | undefined
let lastVoucher: IVoucher | null | undefined
let last: UpdateOrderTotals = EMPTY

export function getUpdateOrderTotals(
  orderItems: IOrderItem[] | undefined,
  voucher: IVoucher | null | undefined,
): UpdateOrderTotals {
  if (!orderItems) return EMPTY
  if (orderItems === lastItems && voucher === lastVoucher) return last
  const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
    transformOrderItemToOrderDetail(orderItems),
    voucher ?? null,
  )
  lastItems = orderItems
  lastVoucher = voucher
  last = { displayItems, cartTotals }
  return last
}
