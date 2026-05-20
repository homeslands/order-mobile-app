import { act, renderHook } from '@testing-library/react-native'

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

jest.mock('@/stores/notification.store', () => ({
  useNotificationStore: jest.fn(
    (selector: (s: typeof mockStoreState) => unknown) =>
      typeof selector === 'function'
        ? selector(mockStoreState)
        : mockStoreState,
  ),
}))

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}))

// Import AFTER mocks (Jest hoisting)
import {
  _resetSnoozeMapForTests,
  useOrderReadyQueue,
} from '@/hooks/use-order-ready-queue'

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
    message: 'order-needs-ready-to-get',
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
  _resetSnoozeMapForTests()
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
    const older = makeNotif({ orderSlug: 'order-old', createdAt: '2026-01-01T10:00:00.000Z' })
    const newer = makeNotif({ orderSlug: 'order-new', createdAt: '2026-01-01T11:00:00.000Z' })
    mockStoreState.notifications = [newer, older] // store prepends newest first
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-old')
  })

  test('pendingCount includes snoozed orders', () => {
    const n1 = makeNotif({ orderSlug: 'order-1' })
    const n2 = makeNotif({ orderSlug: 'order-2' })
    mockStoreState.notifications = [n1, n2]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.pendingCount).toBe(2)
    act(() => { result.current.snooze('order-1') })
    // pendingCount stays 2 — snoozed is still "pending"
    expect(result.current.pendingCount).toBe(2)
    // but activeOrder shifts to order-2
    expect(result.current.activeOrder?.orderSlug).toBe('order-2')
  })

  test('snooze hides the active order and promotes the next one', () => {
    const n1 = makeNotif({ orderSlug: 'order-1', createdAt: '2026-01-01T10:00:00.000Z' })
    const n2 = makeNotif({ orderSlug: 'order-2', createdAt: '2026-01-01T11:00:00.000Z' })
    mockStoreState.notifications = [n1, n2]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-1')
    act(() => { result.current.snooze('order-1') })
    expect(result.current.activeOrder?.orderSlug).toBe('order-2')
  })

  test('snoozed order re-appears after SNOOZE_MS (90s)', () => {
    const n1 = makeNotif({ orderSlug: 'order-solo' })
    mockStoreState.notifications = [n1]
    const { result } = renderHook(() => useOrderReadyQueue())
    act(() => { result.current.snooze('order-solo') })
    expect(result.current.activeOrder).toBeNull()
    // Advance past 90s snooze + 10s interval tick
    act(() => { jest.advanceTimersByTime(100_000) })
    expect(result.current.activeOrder?.orderSlug).toBe('order-solo')
  })

  test('markDone calls markAllReadByOrder and removes from active queue', () => {
    const n1 = makeNotif({ orderSlug: 'order-done' })
    mockStoreState.notifications = [n1]
    const { result } = renderHook(() => useOrderReadyQueue())
    act(() => { result.current.markDone('order-done') })
    expect(mockStoreState.markAllReadByOrder).toHaveBeenCalledWith('order-done')
  })

  test('suppressFor blocks activeOrder for given duration then re-enables', () => {
    const n1 = makeNotif({ orderSlug: 'order-suppressed' })
    mockStoreState.notifications = [n1]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder?.orderSlug).toBe('order-suppressed')
    act(() => { result.current.suppressFor(600) })
    expect(result.current.activeOrder).toBeNull()
    act(() => { jest.advanceTimersByTime(700) })
    expect(result.current.activeOrder?.orderSlug).toBe('order-suppressed')
  })

  test('ignores isRead notifications', () => {
    mockStoreState.notifications = [{
      slug: 'read-notif',
      createdAt: new Date().toISOString(),
      message: 'order-needs-ready-to-get',
      isRead: true,
      metadata: { order: 'order-read', referenceNumber: 'REF', branchName: 'Q1' },
    }]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })

  test('ignores non-ORDER_NEEDS_READY_TO_GET notifications', () => {
    mockStoreState.notifications = [{
      slug: 'other-notif',
      createdAt: new Date().toISOString(),
      message: 'order-paid',
      isRead: false,
      metadata: { order: 'order-other', referenceNumber: 'REF', branchName: 'Q1' },
    }]
    const { result } = renderHook(() => useOrderReadyQueue())
    expect(result.current.activeOrder).toBeNull()
    expect(result.current.pendingCount).toBe(0)
  })
})
