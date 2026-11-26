// Khoá các quyết định hiệu năng của màn Thanh toán. Màn quá nặng để render
// trong test nên kiểm trên mã nguồn, như order-detail-ui.test.ts.
import * as fs from 'fs'
import * as path from 'path'

function read(rel: string) {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const page = read('app/payment/[order].tsx')
const pageEntry = page.slice(
  page.indexOf('export default function PaymentPage'),
)

it('PP1 đã có dữ liệu đơn (tải trước lúc bấm) thì hiện ngay, mốc chuyển màn stack', () => {
  expect(pageEntry).toMatch(/getQueryData\(\['order', /)
  expect(pageEntry).toMatch(/transitionType: 'stack'/)
})

it('PP2 không có lớp chờ thứ hai bên trong (thẻ Điểm không bật ra sau)', () => {
  expect(page).not.toMatch(/transitionReady/)
})

it('PP3 bỏ phần Hoá đơn không bao giờ hiện (đơn PAID đã sang màn thành công)', () => {
  expect(page).not.toMatch(/<InvoiceSection\b/)
})

it('PP4 lần focus đầu không tải lại nếu dữ liệu vừa được tải trước', () => {
  expect(page).toMatch(/getQueryState\(\['order', /)
  expect(page).toMatch(/lastFocusFetchAtRef = useRef\(/)
  expect(page).not.toMatch(/lastFocusFetchAtRef = useRef\(0\)/)
})

it('PP5 không gọi API điểm tích luỹ với mã người dùng rỗng', () => {
  expect(page).toMatch(/if \(loyaltySlug\) void refetchLoyalty\(\)/)
})

it('PP6 ảnh QR giữ trong bộ nhớ, không tải lại mỗi lần hiện', () => {
  expect(page).not.toMatch(/cachePolicy="none"/)
})

it('PP7 không tạo props mới mỗi lần render làm mất memo', () => {
  expect(page).not.toMatch(/onClose=\{\(\) => setShowVoucherSheet\(false\)\}/)
  expect(page).not.toMatch(
    /\? \[order\.payment\.paymentMethod as PaymentMethod\]\s*: \[\]/,
  )
})

it('PP8 số dư Xu chỉ tải khi đơn còn chờ thanh toán', () => {
  expect(page).toMatch(/useCoinBalance\(\s*isLoggedIn && isOrderPending,?\s*\)/)
})
