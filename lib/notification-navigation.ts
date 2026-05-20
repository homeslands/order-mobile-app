/**
 * Notification Navigation — map notification data → app route.
 *
 * Two entry modes:
 * - 'cold-start':     app was killed; JS just booted. Defer ~600ms + retry.
 * - 'background-tap': app was already running. Push immediately (retry once
 *                     if navigation engine is briefly locked).
 *
 * Used by:
 * - Background tap handler (user taps system notification, app warm)
 * - Cold start handler (app opened via notification tap, app killed)
 * - Notification list (user taps item in list — background-tap mode)
 */
import { Platform } from 'react-native'

import { NotificationMessageCode } from '@/constants'
import { isNavigationLocked, navigateNative } from '@/lib/navigation'

export type NotificationNavMode = 'cold-start' | 'background-tap'

interface NotificationRouteData {
  message?: string
  order?: string
  cardOrderSlug?: string
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
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[Notifications] Failed to parse notification payload:',
        data.payload,
        e,
      )
    }
  }

  return { ...data, ...parsed }
}

export function getRouteForMessage(
  routeData: NotificationRouteData,
): string | null {
  const { message, order } = routeData

  switch (message) {
    case NotificationMessageCode.ORDER_NEEDS_READY_TO_GET:
    case NotificationMessageCode.ORDER_NEEDS_PROCESSED:
    case NotificationMessageCode.ORDER_NEEDS_DELIVERED:
    case NotificationMessageCode.ORDER_NEEDS_CANCELLED:
    case NotificationMessageCode.ORDER_PAID:
      return order ? `/order/${order}` : null

    case NotificationMessageCode.CARD_ORDER_PAID: {
      const slug = routeData.cardOrderSlug ?? order
      return slug ? `/profile/gift-card-orders?autoOpen=${slug}` : null
    }

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

// Android (Hermes) bootstraps in ~350-450ms; iOS needs 500-700ms.
const COLD_START_DELAY_MS = Platform.OS === 'android' ? 400 : 600
const NAV_LOCK_RETRY_MS = 120
const NAV_LOCK_MAX_RETRIES = 3

/** Dùng trong _layout.tsx để biết có notification cold-start nav đang pending. */
export function isNotificationNavigationPending(): boolean {
  return pendingNotificationRoute !== null
}

function schedulePush(route: string, delayMs: number): void {
  // Nếu đã có notification nav pending, cancel cái cũ — notification mới ghi đè.
  // Không dedupe: user có thể tap notification khác nhau liên tiếp, ưu tiên cái cuối.
  if (pendingNotificationTimeout) clearTimeout(pendingNotificationTimeout)
  pendingNotificationRoute = route

  const fire = () => {
    pendingNotificationTimeout = null
    let retries = 0
    const tryPush = () => {
      if (!isNavigationLocked()) {
        pendingNotificationRoute = null
        navigateNative.push(route)
        return
      }
      if (retries++ < NAV_LOCK_MAX_RETRIES) {
        setTimeout(tryPush, NAV_LOCK_RETRY_MS)
        return
      }
      // Lock vẫn active — bỏ cuộc để tránh navigate vào screen sai
      pendingNotificationRoute = null
    }
    tryPush()
  }

  if (delayMs <= 0) {
    fire()
  } else {
    pendingNotificationTimeout = setTimeout(fire, delayMs)
  }
}

/**
 * Navigate to the screen associated with a notification.
 *
 * @param data FCM data payload (raw, including stringified `data.payload`)
 * @param mode 'cold-start' applies a 600ms boot delay; 'background-tap' is immediate.
 *             Defaults to 'background-tap' (app warm) for safety — the caller
 *             that knows it's cold-start MUST pass 'cold-start' explicitly.
 * @returns true if navigation was scheduled.
 */
export function navigateFromNotification(
  data: Record<string, string> | undefined,
  mode: NotificationNavMode = 'background-tap',
): boolean {
  const routeData = parseNotificationData(data)
  const route = getRouteForMessage(routeData)

  if (!route) return false

  // Cold start trên iOS: JS bundle load + React mount + NavigationEngineProvider
  // mất 400-700ms. Cần ít nhất 500ms trước khi push để tránh router null.
  // Background tap: app warm, push ngay.
  const delay = mode === 'cold-start' ? COLD_START_DELAY_MS : 0
  schedulePush(route, delay)
  return true
}
