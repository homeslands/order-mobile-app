// Áp mã ở thanh toán bị máy chủ từ chối: MutationCache (lib/query-client.ts)
// đã toast đúng lý do theo mã lỗi trả về (showErrorToast — "Voucher đã hết
// hạn", "Voucher đã hết lượt"…). Toast provider chỉ giữ MỘT toast, và onError
// của lời gọi mutate chạy SAU, nên toast chung "Voucher không hợp lệ" bắn ở đó
// đè mất lý do cụ thể. Toast chung chỉ còn cho lỗi không có mã (mất mạng…).
//
// Kiểm trên mã nguồn vì sheet kéo theo store, query và bottom sheet, dựng
// trong test không đáng.
import * as fs from 'fs'
import * as path from 'path'

const src = fs.readFileSync(
  path.join(__dirname, '../../app/payment/voucher-sheet-in-payment.tsx'),
  'utf8',
)

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('PV-E1 toast chung "voucherInvalid" chỉ bắn khi lỗi không có mã từ máy chủ', () => {
  const calls = src.match(/showToast\(tVoucher\('voucherInvalid'\)/g) ?? []
  expect(calls).toHaveLength(1)
  expect(src).toMatch(
    /extractStatusCode\(error\) == null\)\s*showToast\(\s*tVoucher\('voucherInvalid'\)/,
  )
})
