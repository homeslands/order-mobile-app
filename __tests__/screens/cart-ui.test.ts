// Giỏ hàng: thanh dưới cố định chỉ còn tổng tiền + Đặt hàng; loại đơn / bàn /
// giờ lấy / voucher chuyển vào nội dung cuộn (thẻ dưới danh sách món). Ảnh món
// dùng thumbnail trên máy. Kiểm trên mã nguồn.
import * as fs from 'fs'
import * as path from 'path'

function read(rel: string) {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const footer = read('components/cart/cart-footer.tsx')
const content = read('components/cart/cart-content.tsx')
const options = read('components/cart/cart-order-options.tsx')
const row = read('components/cart/cart-item-row.tsx')

it('CU1 thanh dưới không còn chọn loại đơn / bàn / giờ / voucher', () => {
  const bar = footer.slice(footer.indexOf('footerStyles.container'))
  const barJsx = bar.slice(0, bar.indexOf('{confirmMounted'))
  expect(barJsx).not.toMatch(/openOrderTypeSheet|openVoucherSheet/)
  expect(barJsx).not.toMatch(/<PickupTimeChips\b/)
  expect(barJsx).toMatch(/handleCheckoutPress/)
})

it('CU2 các tuỳ chọn đơn nằm trong nội dung cuộn, dưới danh sách món', () => {
  expect(content).toMatch(/<CartOrderOptions\b/)
  expect(options).toMatch(/<PickupTimeChips\b/)
  expect(options).toMatch(/open\('orderType'\)/)
  expect(options).toMatch(/open\('voucher'\)/)
})

it('CU3 sheet mở qua store dùng chung (thẻ và nút Đặt hàng cùng mở được)', () => {
  expect(footer).toMatch(/useCartSheetStore/)
  expect(footer).toMatch(/open(Sheet)?\('table'\)/)
  expect(footer).toMatch(/open(Sheet)?\('delivery'\)/)
})

it('CU4 ảnh món dùng thumbnail trên máy (MenuItemImage)', () => {
  expect(row).toMatch(/<MenuItemImage\b/)
  expect(row).not.toMatch(/from 'expo-image'/)
})

// FlashList v2 gọi createElement(ListFooterComponent): truyền hàm thì hàm mới
// = component mới → cả phần dưới danh sách dựng lại (mất giờ lấy đã chọn, ô
// ghi chú mất focus). Truyền element.
it('CU5 phần dưới danh sách truyền dạng element, không phải hàm', () => {
  expect(content).toMatch(/ListFooterComponent=\{listFooter\}/)
  expect(content).toMatch(/const listFooter = useMemo\(/)
})

it('CU6 rời giỏ khi ghi chú đơn còn chờ ghi: ghi luôn, không mất', () => {
  const note = read('components/cart/cart-order-note.tsx')
  const cleanup = note.slice(note.indexOf('return () => {'))
  expect(cleanup.slice(0, 400)).toMatch(/cartActions\.setDescription\(/)
})
