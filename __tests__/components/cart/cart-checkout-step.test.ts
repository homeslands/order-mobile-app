// Nút đặt hàng ở giỏ: nhãn và hành động theo thứ còn thiếu của đơn. Trước đây
// đơn giao thiếu địa chỉ/số điện thoại vẫn ghi "Chọn bàn" và bấm không làm gì.
import * as fs from 'fs'
import * as path from 'path'

import { getCartCheckoutStep } from '@/components/cart/cart-checkout-step'

function source(file: string): string {
  return fs
    .readFileSync(path.resolve(__dirname, '../../..', file), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

it('CS1 tại bàn chưa chọn bàn → "Chọn bàn", mở sheet bàn', () => {
  expect(getCartCheckoutStep({ type: 'at-table', tableName: '' })).toEqual({
    missing: 'table',
    labelKey: 'menu.selectTable',
    sheet: 'table',
  })
})

it('CS2 tại bàn đã chọn bàn → đặt hàng', () => {
  expect(getCartCheckoutStep({ type: 'at-table', tableName: 'B5' })).toEqual({
    missing: null,
    labelKey: 'cart.placeOrder',
    sheet: null,
  })
})

it('CS3 giao hàng chưa có địa chỉ → "Nhập địa chỉ giao", mở sheet giao', () => {
  expect(
    getCartCheckoutStep({
      type: 'delivery',
      deliveryAddress: '',
      deliveryPhone: '0901234567',
    }),
  ).toEqual({
    missing: 'delivery-address',
    labelKey: 'cart.enterDeliveryAddress',
    sheet: 'delivery',
  })
})

it('CS4 giao hàng thiếu cả hai → hỏi địa chỉ trước', () => {
  expect(getCartCheckoutStep({ type: 'delivery' }).missing).toBe(
    'delivery-address',
  )
})

it.each([undefined, '', '090123', '09012345678', 'abcdefghij'])(
  'CS5 giao hàng có địa chỉ, số điện thoại %p không hợp lệ → nhập số',
  (phone) => {
    expect(
      getCartCheckoutStep({
        type: 'delivery',
        deliveryAddress: '1 Lê Lợi',
        deliveryPhone: phone,
      }),
    ).toEqual({
      missing: 'delivery-phone',
      labelKey: 'cart.enterPhoneNumber',
      sheet: 'delivery',
    })
  },
)

it('CS6 giao hàng đủ địa chỉ + số 10 chữ số → đặt hàng', () => {
  expect(
    getCartCheckoutStep({
      type: 'delivery',
      deliveryAddress: '1 Lê Lợi',
      deliveryPhone: '0901234567',
    }).missing,
  ).toBeNull()
})

it('CS7 mang đi không cần bàn/địa chỉ (giờ lấy mặc định "ngay") → đặt hàng', () => {
  expect(getCartCheckoutStep({ type: 'take-out' }).missing).toBeNull()
})

it('CS8 đơn giao không bị đòi bàn', () => {
  expect(
    getCartCheckoutStep({
      type: 'delivery',
      tableName: '',
      deliveryAddress: '1 Lê Lợi',
      deliveryPhone: '0901234567',
    }).missing,
  ).toBeNull()
})

// Nối dây ở cart-footer / cart-content (đọc mã nguồn, như cart-lazy-sheets).
it('CS9 danh sách giỏ chừa đáy theo chiều cao đo được của thanh dưới', () => {
  const content = source('components/cart/cart-content.tsx')
  expect(content).not.toMatch(/paddingBottom:\s*200/)
  expect(content).toMatch(/paddingBottom:\s*footerHeight \+ 16/)
  expect(content).toMatch(/<CartFooter[\s\S]*?onLayout=\{onFooterLayout\}/)
})

it('CS10 nút đặt hàng: khoá khi đang kiểm, nhãn lấy theo thứ còn thiếu', () => {
  const footer = source('components/cart/cart-footer.tsx')
  expect(footer).toMatch(/getCartCheckoutStep\(/)
  expect(footer).toMatch(/disabled=\{isChecking\}/)
  expect(footer).toMatch(/t\(checkoutStep\.labelKey\)/)
})
