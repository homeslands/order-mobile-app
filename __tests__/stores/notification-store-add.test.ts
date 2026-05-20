jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
}))

import { useNotificationStore } from '@/stores/notification.store'

const makePayload = (slug: string, message = 'order-needs-ready-to-get') => ({
  data: { slug, message, order: 'order-1', branchName: 'Test Branch' },
})

beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    markedAllReadAt: null,
  })
})

describe('addNotification', () => {
  it('starts notification as unread by default', () => {
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(false)
    expect(n.slug).toBe('n-1')
  })

  it('preserves isRead: true when the same slug is re-added after markAsRead', () => {
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    useNotificationStore.getState().markAsRead('n-1')
    expect(useNotificationStore.getState().notifications[0].isRead).toBe(true)

    // Simulate FCM re-delivery of the same message
    useNotificationStore.getState().addNotification(makePayload('n-1'))

    const n = useNotificationStore.getState().notifications[0]
    expect(n.isRead).toBe(true)
    expect(useNotificationStore.getState().notifications).toHaveLength(1)
  })

  it('unreadCount stays correct when re-adding a read notification', () => {
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    useNotificationStore.getState().addNotification(makePayload('n-2'))
    useNotificationStore.getState().markAsRead('n-1')
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    // Re-add n-1 — must not increment unreadCount
    useNotificationStore.getState().addNotification(makePayload('n-1'))
    expect(useNotificationStore.getState().unreadCount).toBe(1)
    expect(useNotificationStore.getState().notifications).toHaveLength(2)
  })
})
