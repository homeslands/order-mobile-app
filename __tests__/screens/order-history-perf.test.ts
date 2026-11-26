// Khoá các quyết định hiệu năng của màn Lịch sử đơn hàng. Màn quá nặng để
// render trong test nên kiểm trên mã nguồn, như menu-perf.test.ts.
import * as fs from 'fs'
import * as path from 'path'

function read(rel: string) {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const history = read('app/profile/history.tsx')
const productItem = read('app/profile/order-product-item.tsx')
const card = read('app/profile/order-card.tsx')

it('OH1 ảnh món dùng thumbnail trên máy (MenuItemImage), không tải ảnh gốc', () => {
  expect(productItem).toMatch(/<MenuItemImage\b/)
  expect(productItem).not.toMatch(/from 'expo-image'/)
})

it('OH2 gọi lại theo thông báo "đã thanh toán" chờ chuyển màn xong', () => {
  const effect = history.slice(history.indexOf('paidNotificationSlug'))
  expect(effect).toMatch(/if \(!allowFetch\b[^)]*\) return/)
})

it('OH3 có dữ liệu (cache / tải trước) thì hiện ngay, không skeleton', () => {
  expect(history).not.toMatch(/showSkeleton = !allowFetch/)
  expect(history).toMatch(/showSkeleton = !orderResponse/)
  // Skeleton nằm trong vùng danh sách, header + chip lọc là thật → không nhảy.
  expect(history).not.toMatch(/return \(\s*<OrderHistorySkeleton\b/)
})

it('OH4 vòng quay kéo-làm-mới chỉ khi khách tự kéo', () => {
  expect(history).not.toMatch(/refreshing=\{isRefetching\}/)
})

it('OH5 bỏ overrideItemLayout vô tác dụng, có getItemType theo số dòng món', () => {
  expect(history).not.toMatch(/overrideItemLayout/)
  expect(history).toMatch(/getItemType=/)
})

it('OH6 dòng món trong thẻ khoá theo vị trí để FlashList tái dùng ô', () => {
  expect(card).toMatch(/key=\{index\}/)
})

it('OH7 cache hiển thị đổi khi số lượng / tiền đổi (sửa đơn chưa thanh toán)', () => {
  const keyLine = history.match(/const cacheKey = `[^`]*`/)?.[0] ?? ''
  expect(keyLine).toMatch(/subtotal/)
  expect(keyLine).toMatch(/qty/)
})

it('OH8 không subscribe cả object userInfo (đổi điểm / hồ sơ là render lại màn)', () => {
  expect(history).not.toMatch(/useUserStore\(\(s\) => s\.userInfo\)/)
})

it('OH9 tải trước trang đầu ngay lúc bấm vào, từ Hồ sơ và Home', () => {
  expect(read('app/(tabs)/profile/index.tsx')).toMatch(/prefetchOrderHistory\(/)
  expect(read('components/home/home-action-grid.tsx')).toMatch(
    /prefetchOrderHistory\(/,
  )
})
