/**
 * Dựng các dòng của danh sách Lịch sử đơn: nhóm theo ngày tạo (giờ máy),
 * mỗi nhóm có dòng tiêu đề (Hôm nay / Hôm qua / ngày cụ thể) kèm số đơn, và
 * trả chỉ số dòng tiêu đề để FlashList ghim tiêu đề khi cuộn.
 *
 * Đơn giữ nguyên thứ tự API trả (mới → cũ, nhiều trang nối nhau); đơn có
 * ngày giờ hỏng gom vào một nhóm "unknown" ở cuối.
 */
type DatedOrder = { createdAt: string }

export type OrderDay = 'today' | 'yesterday' | 'date'

export type OrderSectionRow<T> =
  | {
      _kind: 'header'
      key: string
      day: OrderDay
      /** YYYY-MM-DD theo giờ máy, hoặc 'unknown' */
      date: string
      count: number
    }
  | { _kind: 'order'; order: T }

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function buildOrderSections<T extends DatedOrder>(
  orders: T[],
  now: Date,
): { rows: OrderSectionRow<T>[]; stickyHeaderIndices: number[] } {
  const today = dayKey(now)
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  const yesterday = dayKey(y)

  const groups = new Map<string, T[]>()
  const unknown: T[] = []
  for (const order of orders) {
    const d = new Date(order.createdAt)
    if (Number.isNaN(d.getTime())) {
      unknown.push(order)
      continue
    }
    const k = dayKey(d)
    const g = groups.get(k)
    if (g) g.push(order)
    else groups.set(k, [order])
  }

  const rows: OrderSectionRow<T>[] = []
  const stickyHeaderIndices: number[] = []
  const push = (date: string, day: OrderDay, list: T[]) => {
    stickyHeaderIndices.push(rows.length)
    rows.push({
      _kind: 'header',
      key: `day-${date}`,
      day,
      date,
      count: list.length,
    })
    for (const order of list) rows.push({ _kind: 'order', order })
  }
  for (const [date, list] of groups) {
    push(
      date,
      date === today ? 'today' : date === yesterday ? 'yesterday' : 'date',
      list,
    )
  }
  if (unknown.length) push('unknown', 'date', unknown)
  return { rows, stickyHeaderIndices }
}

/**
 * Khoảng cách (pt) giữa hai dòng liền nhau: thẻ → thẻ cùng ngày 10; thẻ cuối
 * ngày trước → tiêu đề ngày mới 20 để tách nhóm rõ; quanh tiêu đề khác 0
 * (tiêu đề tự có đệm).
 */
export function orderRowGap<T>(
  leading: OrderSectionRow<T> | undefined,
  trailing: OrderSectionRow<T> | undefined,
): number {
  if (leading?._kind !== 'order' || !trailing) return 0
  return trailing._kind === 'order' ? 10 : 20
}
