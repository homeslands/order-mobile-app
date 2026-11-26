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
const card = read('components/order-history/order-history-card.tsx')

it('OH1 ảnh món dùng thumbnail trên máy (MenuItemImage), không tải ảnh gốc', () => {
  expect(card).toMatch(/<MenuItemImage\b/)
  expect(card).not.toMatch(/from 'expo-image'/)
})

it('OH2 gọi lại theo thông báo "đã thanh toán" chờ chuyển màn xong', () => {
  const effect = history.slice(history.indexOf('paidNotificationSlug'))
  expect(effect).toMatch(/if \(!allowFetch\b[^)]*\) return/)
})

it('OH3 có dữ liệu (cache / tải trước) thì hiện ngay, không skeleton', () => {
  expect(history).not.toMatch(/showSkeleton = !allowFetch/)
  expect(history).toMatch(/showSkeleton = !orderPages/)
  // Skeleton nằm trong vùng danh sách, header + chip lọc là thật → không nhảy.
  expect(history).not.toMatch(/return \(\s*<OrderHistorySkeleton\b/)
})

it('OH4 vòng quay kéo-làm-mới chỉ khi khách tự kéo', () => {
  expect(history).not.toMatch(/refreshing=\{isRefetching\}/)
})

it('OH5 bỏ overrideItemLayout vô tác dụng, có getItemType (tiêu đề / thẻ)', () => {
  expect(history).not.toMatch(/overrideItemLayout/)
  expect(history).toMatch(/getItemType=/)
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

it('OH10 cuộn xuống tự tải trang kế, bỏ nút Trước / Sau', () => {
  expect(history).toMatch(/useOrderHistory\(/)
  expect(history).toMatch(/onEndReached=\{handleEndReached\}/)
  expect(history).toMatch(/fetchNextPage\(\)/)
  expect(history).not.toMatch(/order\.previous|order\.next/)
})

it('OH11 tiêu đề ngày dính; header cố định (không nổi đè lên danh sách)', () => {
  expect(history).toMatch(/stickyHeaderIndices=\{stickyHeaderIndices\}/)
  expect(history).not.toMatch(/floatingHeader/)
})
