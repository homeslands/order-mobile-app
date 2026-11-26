// Sheet xác nhận đơn: thanh nút sát đáy (nền phủ cả vùng an toàn — trước có
// khe hở, cuộn thì lộ nội dung bên dưới), sheet đã đóng không vẽ lại theo giỏ,
// khách thấy đủ thông tin để kiểm tra (địa chỉ / SĐT giao hàng, ghi chú).
// Kiểm trên mã nguồn.
import * as fs from 'fs'
import * as path from 'path'

const src = fs
  .readFileSync(
    path.resolve(
      __dirname,
      '../../../components/cart/cart-confirm-order-sheet.tsx',
    ),
    'utf-8',
  )
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

it('CO1 thanh nút sát đáy, nền phủ cả vùng an toàn (không khe hở)', () => {
  expect(src).toMatch(/<BottomSheetFooter \{\.\.\.props\} bottomInset=\{0\}>/)
  expect(src).toMatch(/paddingBottom: bottomInset \+ /)
})

it('CO2 phần cuộn chừa đủ chỗ thanh nút + vùng an toàn', () => {
  expect(src).toMatch(/FOOTER_HEIGHT \+ bottomInset/)
  expect(src).not.toMatch(/paddingBottom: 80,/)
})

it('CO3 sheet đã đóng không theo dõi cả dữ liệu đơn (chỉ phần thân khi mở)', () => {
  const outer = src.slice(
    src.indexOf('export const ConfirmOrderSheet'),
    src.indexOf('const ConfirmOrderBody'),
  )
  expect(outer).not.toMatch(/useOrderFlowStore\(\(s\) => s\.orderingData\)/)
  expect(outer).not.toMatch(/useCalculateDeliveryFee\(/)
  expect(src).toMatch(/const ConfirmOrderBody = memo\(/)
})

it('CO4 khách thấy đủ để kiểm tra: địa chỉ / SĐT giao hàng, ghi chú đơn và món', () => {
  expect(src).toMatch(/order\.deliveryAddress/)
  expect(src).toMatch(/order\.deliveryPhone/)
  expect(src).toMatch(/t\('order\.orderNote'\)/)
  expect(src).toMatch(/source\?\.note/)
})

it('CO5 không màu viết cứng', () => {
  expect(src).not.toMatch(/'#[0-9a-fA-F]{3,6}'|"#[0-9a-fA-F]{3,6}"/)
})
