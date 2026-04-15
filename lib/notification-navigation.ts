/**
 * Notification Navigation — map notification data → app route.
 *
 * Used by:
 * - Background tap handler (user taps system notification)
 * - Cold start handler (app opened via notification tap)
 * - Notification list (user taps item in list)
 */
import { NotificationMessageCode } from '@/constants'
import { isNavigationLocked, navigateNative } from '@/lib/navigation'

interface NotificationRouteData {
  message?: string
  order?: string
  [key: string]: string | undefined
}

function parseNotificationData(
  data: Record<string, string> | undefined,
): NotificationRouteData {
  if (!data) return {}

  // Backend may send metadata as JSON string in data.payload
  let parsed: Record<string, string> = {}
  if (data.payload && typeof data.payload === 'string') {
    try {
      parsed = JSON.parse(data.payload) as Record<string, string>
    } catch {
      // Ignore
    }
  }

  return { ...data, ...parsed }
}

function getRouteForMessage(
  routeData: NotificationRouteData,
): string | null {
  const { message, order } = routeData

  switch (message) {
    case NotificationMessageCode.ORDER_NEEDS_READY_TO_GET:
      // Customer: order is ready → navigate to order detail
      return order ? `/payment/${order}` : null

    case NotificationMessageCode.ORDER_NEEDS_PROCESSED:
    case NotificationMessageCode.ORDER_NEEDS_DELIVERED:
    case NotificationMessageCode.ORDER_NEEDS_CANCELLED:
      // Staff/Chef: order status change → navigate to order detail
      return order ? `/payment/${order}` : null

    case NotificationMessageCode.ORDER_PAID:
    case NotificationMessageCode.CARD_ORDER_PAID:
      return order ? `/payment/${order}` : null

    case NotificationMessageCode.ORDER_BILL_FAILED_PRINTING:
    case NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING:
    case NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING:
      // Printer failure → navigate to order detail
      return order ? `/payment/${order}` : null

    default:
      return null
  }
}

// Module-level state — cho phép cancel pending notification nav khi có nav mới,
// và cho phép _layout.tsx check pending state để defer focusManager refetch.
let pendingNotificationTimeout: ReturnType<typeof setTimeout> | null = null
let pendingNotificationRoute: string | null = null

/** Dùng trong _layout.tsx để biết có notification cold-start nav đang pending. */
export function isNotificationNavigationPending(): boolean {
  return pendingNotificationRoute !== null
}

/**
 * Navigate to the screen associated with a notification.
 * Returns true if navigation was performed.
 */
export function navigateFromNotification(
  data: Record<string, string> | undefined,
): boolean {
  const routeData = parseNotificationData(data)
  const route = getRouteForMessage(routeData)

  if (!route) return false

  // Nếu đã có notification nav pending, cancel cái cũ — notification mới ghi đè.
  // Không dedupe: user có thể tap notification khác nhau liên tiếp, ưu tiên cái cuối.
  if (pendingNotificationTimeout) {
    clearTimeout(pendingNotificationTimeout)
  }

  pendingNotificationRoute = route

  // Delay để đảm bảo app đã mount xong trước khi navigate.
  // Cold start trên iOS: JS bundle load + React mount + NavigationEngineProvider
  // mất 400-700ms. Navigation engine retry thêm ~330ms (20 rAF frames), nên
  // tổng cộng cần ít nhất 500ms trước khi gọi push để tránh router null.
  pendingNotificationTimeout = setTimeout(() => {
    pendingNotificationTimeout = null

    // Retry nếu navigation đang lock (vd: user vừa tap push khác ngay trước
    // khi timer fire). Tối đa 3 lần × 120ms = 360ms, đủ cho 1 stack transition.
    let retries = 0
    const tryPush = () => {
      if (!isNavigationLocked()) {
        pendingNotificationRoute = null
        navigateNative.push(route)
        return
      }
      if (retries++ < 3) {
        setTimeout(tryPush, 120)
        return
      }
      // Lock vẫn active sau 360ms — bỏ cuộc để tránh navigate vào screen sai
      pendingNotificationRoute = null
    }
    tryPush()
  }, 600)

  return true
}
