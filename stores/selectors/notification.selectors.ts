import { NotificationMessageCode } from '@/constants'

type PaidNotificationLike = {
  slug: string
  isRead: boolean
  message: string
  metadata?: { order?: string }
}

/**
 * Slug của thông báo ORDER_PAID chưa đọc mới nhất (danh sách xếp mới nhất
 * trước), lọc theo đơn nếu có `orderSlug`.
 *
 * Trả chuỗi thay vì phần tử để selector Zustand so sánh bằng `===` và chỉ
 * re-render khi có thông báo mới. Không chỉ xét `notifications[0]`: một
 * thông báo khác loại tới sau (vd. món đã xong) sẽ che mất ORDER_PAID.
 */
export function firstUnreadOrderPaidSlug(
  notifications: PaidNotificationLike[],
  orderSlug?: string,
): string | null {
  const found = notifications.find(
    (n) =>
      !n.isRead &&
      n.message === NotificationMessageCode.ORDER_PAID &&
      (orderSlug === undefined || n.metadata?.order === orderSlug),
  )
  return found?.slug ?? null
}
