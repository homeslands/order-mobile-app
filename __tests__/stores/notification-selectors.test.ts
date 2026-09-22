import { NotificationMessageCode } from '@/constants'
import { firstUnreadOrderPaidSlug } from '@/stores/selectors/notification.selectors'

const paid = (slug: string, order: string, isRead = false) => ({
  slug,
  isRead,
  message: NotificationMessageCode.ORDER_PAID,
  metadata: { order },
})

const other = (slug: string) => ({
  slug,
  isRead: false,
  message: 'order-ready',
  metadata: { order: 'o1' },
})

describe('firstUnreadOrderPaidSlug', () => {
  it('bỏ qua thông báo khác loại nằm trên cùng', () => {
    expect(firstUnreadOrderPaidSlug([other('n2'), paid('n1', 'o1')])).toBe('n1')
  })

  it('bỏ qua thông báo đã đọc', () => {
    expect(firstUnreadOrderPaidSlug([paid('n1', 'o1', true)])).toBeNull()
  })

  it('lọc theo đơn khi có orderSlug', () => {
    const list = [paid('n2', 'o2'), paid('n1', 'o1')]
    expect(firstUnreadOrderPaidSlug(list, 'o1')).toBe('n1')
    expect(firstUnreadOrderPaidSlug(list, 'o3')).toBeNull()
  })

  it('không có orderSlug thì lấy cái mới nhất', () => {
    expect(firstUnreadOrderPaidSlug([paid('n2', 'o2'), paid('n1', 'o1')])).toBe(
      'n2',
    )
  })
})
