jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
}))

import { NotificationMessageCode } from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'
import type { INotification } from '@/types/notification.type'

const makeNotif = (overrides: Partial<INotification> & { slug: string }): INotification => ({
  slug: overrides.slug,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  message: overrides.message ?? NotificationMessageCode.ORDER_NEEDS_PROCESSED,
  senderId: '',
  receiverId: 'user-1',
  type: 'system',
  isRead: overrides.isRead ?? false,
  metadata: {
    order: overrides.metadata?.order ?? 'order-1',
    orderType: '',
    tableName: '',
    table: '',
    branchName: 'Branch',
    branch: '',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    referenceNumber: 'REF',
    cardOrder: '',
    cardOrderCode: '',
  },
})

beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    markedAllReadAt: null,
  })
})

describe('hydrateFromApi — stale order-ready auto-mark', () => {
  it('marks ORDER_NEEDS_READY_TO_GET older than 60 min as read on hydration', () => {
    const staleTs = new Date(Date.now() - 61 * 60 * 1000).toISOString()
    useNotificationStore.getState().hydrateFromApi([
      makeNotif({
        slug: 'n-stale',
        createdAt: staleTs,
        isRead: false,
        message: NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      }),
    ])
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(true)
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('does NOT auto-mark ORDER_NEEDS_READY_TO_GET younger than 60 min as read', () => {
    const freshTs = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    useNotificationStore.getState().hydrateFromApi([
      makeNotif({
        slug: 'n-fresh',
        createdAt: freshTs,
        isRead: false,
        message: NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      }),
    ])
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(false)
    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })

  it('does NOT auto-mark other message types as read even if old', () => {
    const staleTs = new Date(Date.now() - 61 * 60 * 1000).toISOString()
    useNotificationStore.getState().hydrateFromApi([
      makeNotif({
        slug: 'n-other',
        createdAt: staleTs,
        isRead: false,
        message: NotificationMessageCode.ORDER_NEEDS_PROCESSED,
      }),
    ])
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(false)
    expect(useNotificationStore.getState().unreadCount).toBe(1)
  })
})
