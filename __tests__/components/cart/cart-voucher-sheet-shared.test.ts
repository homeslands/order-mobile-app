// Sheet chọn mã ở giỏ hàng từng tự vẽ lại kết quả tìm mã và danh sách
// "Không khả dụng", và truyền onSelect thật cho thẻ mờ: chạm vào mã không
// dùng được vẫn chọn nó (không hiện viền), footer thành "Áp dụng", bấm xong chỉ
// nhận toast chung. Giờ dùng chung đúng hai component của thanh toán/sửa đơn —
// hành vi của chúng được test trong __tests__/update-order/.
//
// Kiểm trên mã nguồn vì sheet giỏ hàng kéo theo store, query và bottom sheet,
// dựng trong test không đáng.
import * as fs from 'fs'
import * as path from 'path'

const src = fs.readFileSync(
  path.join(__dirname, '../../../components/cart/cart-voucher-sheet.tsx'),
  'utf8',
)

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('CS-SH1 kết quả tìm mã dùng SearchResult chung', () => {
  expect(src).toMatch(/<SearchResult\b/)
  expect(src).not.toMatch(/tVoucher\('codeNotFound'/)
})

it('CS-SH2 danh sách không khả dụng dùng InvalidList chung', () => {
  expect(src).toMatch(/<InvalidList\b/)
  expect(src).not.toMatch(/invalidVouchers\.slice\(0, 5\)\.map/)
})
