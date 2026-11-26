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

// Mở sheet ngay khi bấm Đặt hàng — kiểm giỏ với menu hôm nay + cờ loại đơn
// chạy song song (trước phải chờ xong mới mở, mạng chậm là 0.5–1s chỉ thấy
// vòng quay). Nút Đặt trong sheet khoá tới khi kiểm xong.
const footer = fs
  .readFileSync(
    path.resolve(__dirname, '../../../components/cart/cart-footer.tsx'),
    'utf-8',
  )
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

it('CO6 bấm Đặt hàng mở sheet trước, kiểm tra chạy sau', () => {
  const prep = footer.slice(footer.indexOf('const prepareConfirm'))
  const open = prep.indexOf('setConfirmSheetVisible(true)')
  const wait = prep.indexOf('await Promise.all')
  expect(open).toBeGreaterThan(-1)
  expect(wait).toBeGreaterThan(open)
})

it('CO7 kiểm tra không đạt thì đóng sheet', () => {
  const prep = footer.slice(footer.indexOf('const prepareConfirm'))
  expect(prep).toMatch(/setConfirmSheetVisible\(false\)/)
})

it('CO8 nút Đặt trong sheet khoá khi đang kiểm tra', () => {
  expect(src).toMatch(/disabled=\{isSubmitting \|\| isChecking\}/)
  expect(src).toMatch(/cart\.checkingOrder/)
  expect(footer).toMatch(/isChecking=\{isChecking\}/)
})
