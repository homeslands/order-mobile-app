// Tiền giỏ một nguồn: thẻ món, thanh dưới, sheet chọn voucher và sheet xác
// nhận cùng ra một số. Trước thanh dưới cộng giá GỐC (trước khuyến mãi) nên
// món đang giảm giá làm tổng cao hơn tổng các thẻ; voucher thì mỗi chỗ tính
// một kiểu.
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { getCartPricing } from '@/stores/cart-pricing'
import type { IOrderItem, IVoucher } from '@/types'
import { calculateCartDisplayAndTotals } from '@/utils/cart'

function item(
  id: string,
  originalPrice: number,
  quantity: number,
  promotionValue = 0,
): IOrderItem {
  return {
    id,
    slug: `p-${id}`,
    name: id,
    quantity,
    originalPrice,
    promotionValue,
  } as IOrderItem
}

const samePrice = {
  type: VOUCHER_TYPE.SAME_PRICE_PRODUCT,
  value: 30000,
  applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
  minOrderValue: 0,
  voucherProducts: [{ product: { slug: 'p-a' } }],
} as unknown as IVoucher

it('CP1 món khuyến mãi: tổng là giá SAU khuyến mãi, không phải giá gốc', () => {
  const p = getCartPricing([item('a', 50000, 2, 20), item('b', 30000, 1)], null)
  expect(p.subtotalAfterPromotion).toBe(110000)
  expect(p.finalTotal).toBe(110000)
  expect(p.voucherDiscount).toBe(0)
})

it('CP2 giá từng món theo id, khớp tổng', () => {
  const items = [item('a', 50000, 2, 20), item('b', 30000, 1)]
  const p = getCartPricing(items, null)
  expect(p.finalPriceById).toEqual({ a: 40000, b: 30000 })
})

it('CP3 có voucher: cùng con số với sheet xác nhận', () => {
  const items = [item('a', 50000, 2, 20), item('b', 30000, 1)]
  const p = getCartPricing(items, samePrice)
  const ref = calculateCartDisplayAndTotals(
    { orderItems: items, voucher: samePrice },
    samePrice,
  ).cartTotals
  expect(p.finalTotal).toBe(ref.finalTotal)
  expect(p.voucherDiscount).toBe(ref.voucherDiscount)
  expect(p.finalPriceById.a).toBe(30000)
  // Đánh giá voucher khác dựa trên tổng sau khuyến mãi — không phụ thuộc
  // voucher đang chọn
  expect(p.subtotalAfterPromotion).toBe(110000)
})

it('CP4 giỏ không đổi thì không tính lại (selector gọi mỗi lần store đổi)', () => {
  const items = [item('a', 50000, 2, 20)]
  expect(getCartPricing(items, null)).toBe(getCartPricing(items, null))
})

it('CP5 giỏ trống', () => {
  expect(getCartPricing(undefined, null).finalTotal).toBe(0)
  expect(getCartPricing([], null).finalPriceById).toEqual({})
})

// Global lười của Expo nạp lúc dọn test → lỗi "import outside scope"; chạm
// trước khi môi trường đóng
afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})
