// Lịch sử đơn nhóm theo ngày (Hôm nay / Hôm qua / ngày cụ thể), tiêu đề ngày
// dính khi cuộn. Đơn đến theo thứ tự mới → cũ từ API, nhiều trang nối nhau.
import { buildOrderSections, orderRowGap } from '@/lib/order-sections'

const o = (slug: string, createdAt: string) => ({ slug, createdAt })
// 26/11/2026 10:00 giờ máy
const NOW = new Date(2026, 10, 26, 10, 0, 0)

const view = (
  rows: ReturnType<
    typeof buildOrderSections<{ slug: string; createdAt: string }>
  >['rows'],
) =>
  rows.map((r) =>
    r._kind === 'header'
      ? `# ${r.day}${r.day === 'date' ? ' ' + r.date : ''} (${r.count})`
      : r.order.slug,
  )

it('OS1 nhóm Hôm nay / Hôm qua / ngày cụ thể, kèm số đơn', () => {
  const { rows } = buildOrderSections(
    [
      o('a', new Date(2026, 10, 26, 9, 0).toISOString()),
      o('b', new Date(2026, 10, 26, 0, 5).toISOString()),
      o('c', new Date(2026, 10, 25, 23, 50).toISOString()),
      o('d', new Date(2026, 10, 20, 12, 0).toISOString()),
    ],
    NOW,
  )
  expect(view(rows)).toEqual([
    '# today (2)',
    'a',
    'b',
    '# yesterday (1)',
    'c',
    '# date 2026-11-20 (1)',
    'd',
  ])
})

it('OS2 tiêu đề ngày dính: chỉ số đúng dòng tiêu đề', () => {
  const { stickyHeaderIndices } = buildOrderSections(
    [
      o('a', new Date(2026, 10, 26, 9, 0).toISOString()),
      o('c', new Date(2026, 10, 25, 9, 0).toISOString()),
      o('d', new Date(2026, 10, 25, 8, 0).toISOString()),
    ],
    NOW,
  )
  expect(stickyHeaderIndices).toEqual([0, 2])
})

it('OS3 không có đơn: không dòng nào', () => {
  expect(buildOrderSections([], NOW)).toEqual({
    rows: [],
    stickyHeaderIndices: [],
  })
})

it('OS4 ngày giờ hỏng: gom vào một nhóm riêng ở cuối, không làm sập', () => {
  const { rows } = buildOrderSections(
    [o('a', new Date(2026, 10, 26, 9, 0).toISOString()), o('x', 'bad')],
    NOW,
  )
  expect(view(rows)).toEqual(['# today (1)', 'a', '# date unknown (1)', 'x'])
})

// Khoảng cách trong danh sách: giữa hai thẻ cùng ngày 10, trước tiêu đề ngày
// mới (sau thẻ cuối ngày trước) rộng hơn để tách nhóm rõ.
it('OS5 khoảng cách: thẻ→thẻ 10, thẻ→tiêu đề ngày 20, tiêu đề→thẻ 0', () => {
  const card = { _kind: 'order' as const, order: o('a', '') }
  const head = {
    _kind: 'header' as const,
    key: 'h',
    day: 'today' as const,
    date: '2026-11-26',
    count: 1,
  }
  expect(orderRowGap(card, card)).toBe(10)
  expect(orderRowGap(card, head)).toBe(20)
  expect(orderRowGap(head, card)).toBe(0)
  expect(orderRowGap(undefined, card)).toBe(0)
})
