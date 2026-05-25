jest.mock('@/lib/navigation', () => ({
  isNavigationLocked: jest.fn(() => false),
  navigateNative: { push: jest.fn() },
}))

jest.mock('@/constants', () => ({
  NotificationMessageCode: {
    ORDER_NEEDS_READY_TO_GET: 'order-needs-ready-to-get',
    ORDER_NEEDS_PROCESSED: 'order-needs-processed',
    ORDER_NEEDS_DELIVERED: 'order-needs-delivered',
    ORDER_NEEDS_CANCELLED: 'order-needs-cancelled',
    ORDER_PAID: 'order-paid',
    CARD_ORDER_PAID: 'card-order-paid',
    ORDER_BILL_FAILED_PRINTING: 'order-bill-failed-printing',
    ORDER_CHEF_ORDER_FAILED_PRINTING: 'order-chef-order-failed-printing',
    ORDER_LABEL_TICKET_FAILED_PRINTING: 'order-label-ticket-failed-printing',
  },
}))

import { getRouteForMessage } from '@/lib/notification-navigation'
import { NotificationMessageCode } from '@/constants'

describe('getRouteForMessage', () => {
  it('routes CARD_ORDER_PAID using cardOrderSlug field', () => {
    const route = getRouteForMessage({
      message: NotificationMessageCode.CARD_ORDER_PAID,
      cardOrderSlug: 'card-abc',
    })
    expect(route).toBe('/profile/gift-card-orders?autoOpen=card-abc')
  })

  it('falls back to order field when cardOrderSlug is absent', () => {
    const route = getRouteForMessage({
      message: NotificationMessageCode.CARD_ORDER_PAID,
      order: 'order-abc',
    })
    expect(route).toBe('/profile/gift-card-orders?autoOpen=order-abc')
  })

  it('returns null for CARD_ORDER_PAID when both slug fields are missing', () => {
    const route = getRouteForMessage({
      message: NotificationMessageCode.CARD_ORDER_PAID,
    })
    expect(route).toBeNull()
  })

  it('routes ORDER_PAID to order detail screen', () => {
    const route = getRouteForMessage({
      message: NotificationMessageCode.ORDER_PAID,
      order: 'order-xyz',
    })
    expect(route).toBe('/order/order-xyz')
  })
})
