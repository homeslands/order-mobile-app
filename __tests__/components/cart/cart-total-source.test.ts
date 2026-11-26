// Thanh dưới và thẻ món lấy tiền từ cùng nguồn getCartPricing — trước mỗi
// chỗ tự tính (thanh dưới cộng giá gốc, thẻ món tự trừ voucher). Kiểm mã nguồn.
import * as fs from 'fs'
import * as path from 'path'

const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, '../../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

it('TS1 selector giỏ đọc từ getCartPricing, không tự cộng giá gốc', () => {
  const store = read('stores/cart.store.ts')
  expect(store).toMatch(/getCartPricing\(/)
  expect(store).not.toMatch(/item\.originalPrice \?\? 0\) \* \(item\.quantity/)
  expect(store).not.toMatch(/calcItemVoucherDiscount/)
})

it('TS2 thanh dưới hiện tổng phải trả từ nguồn chung', () => {
  const footer = read('components/cart/cart-footer.tsx')
  expect(footer).toMatch(/useCartFinalTotal\(\)/)
  expect(footer).not.toMatch(/total - voucherDiscount/)
})

it('TS3 thẻ món dùng đơn giá cuối từ nguồn chung', () => {
  const row = read('components/cart/cart-item-row.tsx')
  expect(row).toMatch(/useCartItemFinalPrice\(item\.cartKey\)/)
  expect(row).not.toMatch(/useCartItemVoucherDiscount/)
})
