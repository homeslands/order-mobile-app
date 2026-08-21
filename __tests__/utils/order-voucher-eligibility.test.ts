/**
 * Với đơn đã đặt, `orderDetail.slug` là slug của DÒNG order-detail, không phải
 * của sản phẩm. Việc đối chiếu voucherProducts phải luôn dùng
 * `variant.product.slug`. Native (Swift/Kotlin) từng lấy `slug` trước nên
 * không bao giờ khớp → màn thanh toán mất dòng "Mã giảm giá".
 */
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants/voucher.constant'
import type { IDisplayOrderItem, IOrderDetail, IVoucher } from '@/types'
import { calculatePlacedOrderTotals } from '@/utils/cart-totals'
import { calculateOrderItemDisplay } from '@/utils/order-item-display'

const PRODUCT_SLUG = 'fb8befeafa'
const ORDER_DETAIL_SLUG = 'orderdetail-9d5ab77aad'

const orderItem = {
  slug: ORDER_DETAIL_SLUG,
  quantity: 1,
  variant: { price: 5000, product: { slug: PRODUCT_SLUG, name: 'Trà đào' } },
} as unknown as IOrderDetail

const voucher = {
  slug: 'voucher-ne',
  type: VOUCHER_TYPE.FIXED_VALUE,
  value: 2000,
  applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
  minOrderValue: 0,
  voucherProducts: [{ product: { slug: PRODUCT_SLUG } }],
} as unknown as IVoucher

describe('đối chiếu voucher với món trong đơn đã đặt', () => {
  it('khớp theo product slug dù order-detail slug khác hẳn', () => {
    const displayItems = calculateOrderItemDisplay([orderItem], voucher)

    expect(displayItems[0].productSlug).toBe(PRODUCT_SLUG)

    const totals = calculatePlacedOrderTotals(displayItems, voucher)
    expect(totals?.voucherDiscount).toBe(2000)
    expect(totals?.finalTotal).toBe(3000)
  })

  it('không giảm khi sản phẩm trong đơn nằm ngoài danh sách của voucher', () => {
    const otherVoucher = {
      ...voucher,
      voucherProducts: [{ product: { slug: 'san-pham-khac' } }],
    } as unknown as IVoucher

    const displayItems = calculateOrderItemDisplay([orderItem], otherVoucher)
    const totals = calculatePlacedOrderTotals(
      displayItems as IDisplayOrderItem[],
      otherVoucher,
    )
    expect(totals?.voucherDiscount).toBe(0)
  })
})
