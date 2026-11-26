// Khoá các quyết định giao diện / hiệu năng của màn Chi tiết đơn. Màn quá
// nặng để render trong test nên kiểm trên mã nguồn.
import * as fs from 'fs'
import * as path from 'path'

function read(rel: string) {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const detail = read('app/order/[id].tsx')
const productItem = read('app/payment/payment-product-item.tsx')

it('OD1 nhãn trạng thái dùng chung với Lịch sử đơn', () => {
  expect(detail).toMatch(/<OrderStatusBadge\b/)
  expect(detail).toMatch(/getOrderHistoryStatus\(/)
  // Không còn tự ghép màu theo từng trạng thái ngay trong màn.
  expect(detail).not.toMatch(/order\.status === OrderStatus\.PAID \|\|/)
})

it('OD2 lúc tải hiện khung skeleton, không vòng quay toàn màn', () => {
  expect(detail).not.toMatch(/<ActivityIndicator size="large"/)
})

it('OD3 vòng quay kéo-làm-mới chỉ khi khách tự kéo', () => {
  expect(detail).not.toMatch(/refreshing=\{isRefetching\}/)
})

it('OD4 ảnh món dùng thumbnail trên máy (dùng chung với màn Thanh toán)', () => {
  expect(productItem).toMatch(/<MenuItemImage\b/)
  expect(productItem).not.toMatch(/from 'expo-image'/)
})

it('OD5 không màu viết cứng', () => {
  expect(detail).not.toMatch(/'#ffffff'/)
  expect(detail).not.toMatch(/\}18`/)
})

it('OD6 đã có dữ liệu đơn (Lịch sử tải trước lúc bấm) thì hiện ngay, không chờ chuyển màn', () => {
  expect(detail).toMatch(/getQueryData\(\['order', id\]\)/)
})

it('OD7 nút "Cập nhật đơn" là nút viền, nhường "Thanh toán" làm hành động chính', () => {
  const btn = detail.slice(detail.indexOf('onPress={handleUpdateOrder}'))
  expect(btn.slice(0, 300)).not.toMatch(/backgroundColor: primaryColor/)
})

it('OD8 mã đơn là số tham chiếu dễ đọc (không phải slug), chạm để sao chép', () => {
  expect(detail).toMatch(/order\??\.referenceNumber/)
  expect(detail).toMatch(/Clipboard\.setStringAsync\(/)
  expect(detail).not.toMatch(/#\{order\.slug\}/)
})

it('OD9 "Khách hàng / Điện thoại" chỉ hiện với đơn giao hàng', () => {
  expect(detail).toMatch(/isDelivery && \([\s\S]{0,600}order\.customer/)
})

it('OD10 thanh toán: tổng nổi bật kèm số món; phương thức + trạng thái gộp một dòng', () => {
  expect(detail).toMatch(/menu\.catalogItemCount/)
  expect(detail).toMatch(/\[paymentMethodLabel, paymentStatusLabel\]/)
})

it('OD11 ghi chú món là dòng chữ, không phải ô nhập bị khoá', () => {
  expect(productItem).not.toMatch(/<TextInput\b/)
})
