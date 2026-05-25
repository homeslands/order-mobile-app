import { act, renderHook } from '@testing-library/react-native'

jest.mock('@/api/notification', () => ({
  markNotificationAsRead: jest.fn().mockResolvedValue(undefined),
}))

// ─── Shared mutable store state ──────────────────────────────────────────────
const mockStoreState = {
  notifications: [] as Array<{
    slug: string
    createdAt: string
    message: string
    isRead: boolean
    metadata: {
      order: string
      referenceNumber?: string
      branchName: string
    }
  }>,
  markAllReadByOrder: jest.fn(),
}

jest.mock('@/stores/notification.store', () => {
  const mockFn = Object.assign(
    jest.fn((selector: (s: typeof mockStoreState) => unknown) =>
      typeof selector === 'function'
        ? selector(mockStoreState)
        : mockStoreState,
    ),
    { getState: () => mockStoreState },
  )
  return { useNotificationStore: mockFn }
})

// Import AFTER mocks (Jest hoisting)
import { NotificationMessageCode } from '@/constants/notification.constant'
import { useOrderReadyQueue } from '@/hooks/use-order-ready-queue'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNotif(overrides: {
  slug?: string
  orderSlug?: string
  createdAt?: string
  referenceNumber?: string
  branchName?: string
}) {
  return {
    slug: overrides.slug ?? `notif-${Math.random()}`,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    message: NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
    isRead: false,
    metadata: {
      order: overrides.orderSlug ?? `order-${Math.random()}`,
      referenceNumber: overrides.referenceNumber ?? 'REF-001',
      branchName: overrides.branchName ?? 'Q1',
    },
  }
}

beforeEach(() => {
  mockStoreState.notifications = []
  mockStoreState.markAllReadByOrder.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useOrderReadyQueue', () => {
  test('returns null activeOrder when no notifications', () => {
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })

  test('returns oldest notification first (FIFO)', () => {
    const older = makeNotif({
      orderSlug: 'order-old',
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    })
    const newer = makeNotif({
      orderSlug: 'order-new',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    })
    mockStoreState.notifications = [newer, older]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-old')
  })

  test('pendingCount reflects total unread ORDER_NEEDS_READY_TO_GET', () => {
    const n1 = makeNotif({ orderSlug: 'order-1' })
    const n2 = makeNotif({ orderSlug: 'order-2' })
    mockStoreState.notifications = [n1, n2]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.pendingCount).toBe(2)
  })

  test('markDone calls markAllReadByOrder and removes from active queue', () => {
    const n1 = makeNotif({ orderSlug: 'order-done' })
    mockStoreState.notifications = [n1]
    const { result, rerender } = renderHook(() => useOrderReadyQueue())
    act(() => {
      result.current.markDone('order-done')
      mockStoreState.notifications = []
    })
    rerender(undefined)
    expect(mockStoreState.markAllReadByOrder).toHaveBeenCalledWith('order-done')
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })

  test('suppressFor blocks activeOrder on next useMemo run, re-enables after expiry', () => {
    const n1 = makeNotif({ orderSlug: 'order-1' })
    const n2 = makeNotif({
      orderSlug: 'order-2',
      createdAt: new Date(Date.now() + 1000).toISOString(),
    })
    mockStoreState.notifications = [n1, n2]
    const { result, rerender } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-1')
    act(() => {
      result.current.suppressFor(600)
      // Simulate markDone(n1) → notifications change → useMemo re-runs while suppressed
      mockStoreState.notifications = [n2]
    })
    rerender(undefined)
    expect(result.current.activeOrder).toBeNull()
    act(() => {
      jest.advanceTimersByTime(700)
    })
    expect(result.current.activeOrder?.orderSlug).toBe('order-2')
  })

  test('ignores isRead notifications', () => {
    mockStoreState.notifications = [
      {
        slug: 'read-notif',
        createdAt: new Date().toISOString(),
        message: NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
        isRead: true,
        metadata: {
          order: 'order-read',
          referenceNumber: 'REF',
          branchName: 'Q1',
        },
      },
    ]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })

  test('ignores non-ORDER_NEEDS_READY_TO_GET notifications', () => {
    mockStoreState.notifications = [
      {
        slug: 'other-notif',
        createdAt: new Date().toISOString(),
        message: 'order-paid',
        isRead: false,
        metadata: {
          order: 'order-other',
          referenceNumber: 'REF',
          branchName: 'Q1',
        },
      },
    ]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })
})
