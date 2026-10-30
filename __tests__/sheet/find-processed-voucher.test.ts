// Sheet điều kiện đánh dấu đạt/chưa đạt dựa trên bản đã validate của chính
// voucher đang mở. Voucher có thể đến từ danh sách HOẶC từ ô tìm mã / quét QR
// (không nằm trong danh sách) — thiếu nguồn nào thì sheet rơi về liệt kê
// trung tính, không nói được vì sao mã không dùng được.
import * as fs from 'fs'
import * as path from 'path'

import {
  findProcessedVoucher,
  type ProcessedVoucher,
} from '@/components/sheet/voucher-validation'

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

const p = (slug: string) =>
  ({ voucher: { slug }, errorMessage: `lỗi ${slug}` }) as ProcessedVoucher

it('FP1 tìm thấy trong danh sách', () => {
  expect(findProcessedVoucher('b', null, [p('a'), p('b')])?.errorMessage).toBe(
    'lỗi b',
  )
})

it('FP2 voucher từ ô tìm mã / quét QR (ngoài danh sách)', () => {
  expect(findProcessedVoucher('q', p('q'), [p('a')])?.errorMessage).toBe(
    'lỗi q',
  )
})

it('FP3 không có voucher đang mở thì không có gì', () => {
  expect(findProcessedVoucher(undefined, p('q'), [p('a')])).toBeUndefined()
  expect(findProcessedVoucher('z', p('q'), [p('a')])).toBeUndefined()
})

const SHEETS = [
  'components/cart/cart-voucher-sheet.tsx',
  'app/payment/voucher-sheet-in-payment.tsx',
  'app/update-order/components/voucher-sheet-in-update-order/index.tsx',
]

it.each(SHEETS)(
  'FP4 %s truyền trạng thái điều kiện và lý do vào sheet',
  (f) => {
    const src = fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf-8')
    expect(src).toMatch(/findProcessedVoucher\(/)
    expect(src).toMatch(/conditionStatus=\{/)
    expect(src).toMatch(/errorMessage=\{/)
  },
)
