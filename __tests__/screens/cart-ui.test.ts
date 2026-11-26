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

it('CU7 chọn "Tại bàn" là tải trước danh sách bàn (sheet mở ra có ngay)', () => {
  expect(options).toMatch(/prefetchQuery\(tablesQueryOptions\(/)
})

it('CU8 ô bàn là component memo, chọn bàn không dựng lại mọi ô', () => {
  const sheet = read('components/cart/cart-table-sheet.tsx')
  expect(sheet).toMatch(/const TableChip = memo\(/)
  expect(sheet).not.toMatch(/onPress=\{\(\) => handleSelect\(table\)\}/)
  expect(sheet).not.toMatch(/'Trống'|'Đặt'|Đang tải\.\.\.|Không có bàn nào/)
})

it('CU9 tiêu đề Ghi chú đơn cùng kiểu dòng Voucher (biểu tượng màu chính, chữ đậm)', () => {
  const note = read('components/cart/cart-order-note.tsx')
  expect(note).toMatch(/<NotebookText size=\{18\} color=\{primaryColor\}/)
  expect(content).toMatch(/<CartOrderNote[^>]*primaryColor=\{primaryColor\}/)
})

it('CU10 nút Đặt hàng thiếu thông tin vẫn màu chính, ghi rõ việc cần làm (không giả như bị khoá)', () => {
  expect(footer).not.toMatch(/isMissingInfo && ft\.disabledTextColor/)
  expect(footer).not.toMatch(/isMissingInfo\s*\?\s*isDark\s*\?\s*colors\.gray/)
  const step = read('components/cart/cart-checkout-step.ts')
  expect(step).toMatch(/cart\.selectTableToOrder/)
})

it('CU11 nút xoá cả giỏ trung tính (kính), chỉ biểu tượng màu đỏ', () => {
  const cart = read('app/(tabs)/cart.tsx')
  const btn = cart.slice(cart.indexOf('function CartClearBtn'))
  expect(btn.slice(0, 900)).toMatch(/<GlassHeaderButton\b/)
  expect(btn.slice(0, 900)).not.toMatch(/colors\.white\.light/)
})

// Bàn phím che ô ghi chú đơn / ghi chú món cuối danh sách: danh sách tự chừa
// chỗ bàn phím và cuộn tới ô đang nhập (iOS: ScrollView tự xử lý first
// responder khi bật automaticallyAdjustKeyboardInsets).
it('CU12 danh sách giỏ chừa chỗ bàn phím, chạm ngoài không tắt nhầm', () => {
  const list = content.slice(content.indexOf('<FlashList'))
  expect(list.slice(0, 800)).toMatch(/automaticallyAdjustKeyboardInsets/)
  expect(list.slice(0, 800)).toMatch(/keyboardShouldPersistTaps="handled"/)
})
