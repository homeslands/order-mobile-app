// Khoá các quyết định giao diện màn Thanh toán. Màn quá nặng để render trong
// test nên kiểm trên mã nguồn.
import * as fs from 'fs'
import * as path from 'path'

function read(rel: string) {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const page = read('app/payment/[order].tsx')
const info = read('app/payment/payment-order-info-card.tsx')
const loyalty = read('app/payment/loyalty-points-input.tsx')
const body = page.slice(page.indexOf('<PaymentOrderInfoCard'))

it('PU1 chốt số tiền trước (voucher, điểm, tổng) rồi mới tới phương thức + QR', () => {
  const method = body.indexOf('<PaymentMethodSection')
  for (const mark of [
    'onPress={openVoucherSheet}',
    '<LoyaltyPointsInput',
    '<PaymentSummaryCard',
  ]) {
    expect(body.indexOf(mark)).toBeGreaterThan(-1)
  }
  expect(method).toBeGreaterThan(body.indexOf('onPress={openVoucherSheet}'))
  expect(method).toBeGreaterThan(body.indexOf('<LoyaltyPointsInput'))
  expect(method).toBeGreaterThan(body.indexOf('<PaymentSummaryCard'))
})

it('PU2 thông tin đơn giống Chi tiết đơn: nhãn dùng chung, mã số dễ đọc, chạm sao chép', () => {
  expect(info).toMatch(/<OrderStatusBadge\b/)
  expect(info).toMatch(/getOrderHistoryStatus\(/)
  expect(info).toMatch(/order\.referenceNumber/)
  expect(info).toMatch(/Clipboard\.setStringAsync\(/)
  expect(info).not.toMatch(/#\{order\.slug\}/)
})

it('PU3 tên / SĐT khách chỉ hiện với đơn giao hàng', () => {
  expect(info).toMatch(/isDelivery && \([\s\S]{0,400}order\.customer/)
})

it('PU4 dòng Voucher rõ là bấm được: có mũi tên', () => {
  const row = body.slice(
    body.indexOf('onPress={openVoucherSheet}'),
    body.indexOf('onPress={openVoucherSheet}') + 2500,
  )
  expect(row).toMatch(/<ChevronRight\b/)
})

it('PU5 tiêu đề màn là "Thanh toán đơn hàng" (không phải "Pay")', () => {
  expect(page).toMatch(/title=\{t\('menu\.payment'\)\}/)
})

it('PU6 không ghép màu viết cứng kiểu `${color}18`', () => {
  for (const src of [page, info, loyalty]) {
    expect(src).not.toMatch(/\}(12|18|20)`/)
  }
})
