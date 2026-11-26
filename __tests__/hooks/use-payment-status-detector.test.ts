import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'

import { NotificationMessageCode, PaymentMethod } from '@/constants'
import { usePaymentStatusDetector } from '@/hooks/use-payment-status-detector'
import { OrderStatus } from '@/types'

// ── Mock ──────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseNotificationStore = jest.fn<unknown, [(s: any) => unknown]>()

jest.mock('@/stores', () => ({
  useNotificationStore: (sel: (s: unknown) => unknown) =>
    mockUseNotificationStore(sel),
}))

type FakeNotification = {
  slug: string
  isRead: boolean
  message: string
  metadata?: { order?: string }
}

function setNotifications(notifications: FakeNotification[]) {
  mockUseNotificationStore.mockImplementation((sel) => sel({ notifications }))
}

// ── Shared defaults ───────────────────────────────────────────────────────────
const base = {
  orderSlug: 'order-1',
  orderStatus: OrderStatus.PENDING as OrderStatus | undefined,
  onPaid: jest.fn(),
}

beforeEach(() => {
  setNotifications([])
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

// ── Shared: orderStatus PAID always wins ──────────────────────────────────────
it('showSuccess = false when submittedAt = null and order PENDING', () => {
  const { result } = renderHook(() =>
    usePaymentStatusDetector({
      ...base,
      method: PaymentMethod.BANK_TRANSFER,
      submittedAt: null,
    }),
  )
  expect(result.current.showSuccess).toBe(false)
})

it('showSuccess = true when orderStatus = PAID regardless of method', () => {
  const { result } = renderHook(() =>
    usePaymentStatusDetector({
      ...base,
      method: PaymentMethod.BANK_TRANSFER,
      submittedAt: null,
      orderStatus: OrderStatus.PAID,
    }),
  )
  expect(result.current.showSuccess).toBe(true)
})

// ── POINT ─────────────────────────────────────────────────────────────────────
describe('POINT', () => {
  it('showSuccess = true immediately when submittedAt is set', () => {
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(true)
  })

  it('showSuccess = false when submittedAt = null', () => {
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: null,
      }),
    )
    expect(result.current.showSuccess).toBe(false)
  })

  it('calls onPaid once for silent background sync', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('does not start polling (no extra onPaid calls after sync)', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.POINT,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    // Exactly 1 call: silent sync only, no polling ticks
    expect(onPaid).toHaveBeenCalledTimes(1)
  })
})

// ── BANK_TRANSFER ─────────────────────────────────────────────────────────────
describe('BANK_TRANSFER', () => {
  it('showSuccess = true when matching ORDER_PAID notification exists', () => {
    setNotifications([
      {
        slug: 'n1',
        isRead: false,
        message: NotificationMessageCode.ORDER_PAID,
        metadata: { order: 'order-1' },
      },
    ])
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(true)
  })

  it('calls onPaid once when FCM notification matches', () => {
    const onPaid = jest.fn()
    setNotifications([
      {
        slug: 'n1',
        isRead: false,
        message: NotificationMessageCode.ORDER_PAID,
        metadata: { order: 'order-1' },
      },
    ])
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('showSuccess = false when notification targets a different order', () => {
    setNotifications([
      {
        slug: 'n1',
        isRead: false,
        message: NotificationMessageCode.ORDER_PAID,
        metadata: { order: 'other-order' },
      },
    ])
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(false)
  })

  it('showSuccess = false when notification is already read', () => {
    setNotifications([
      {
        slug: 'n1',
        isRead: true,
        message: NotificationMessageCode.ORDER_PAID,
        metadata: { order: 'order-1' },
      },
    ])
    const { result } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
      }),
    )
    expect(result.current.showSuccess).toBe(false)
  })

  it('polling does not start when submittedAt = null', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: null,
        onPaid,
      }),
    )
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(onPaid).not.toHaveBeenCalled()
  })

  it('polling fires onPaid after 10s (first tick)', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    expect(onPaid).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(10_000)
    })
    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('polling uses exponential backoff: 10s then 15s', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    act(() => {
      jest.advanceTimersByTime(10_000)
    })
    expect(onPaid).toHaveBeenCalledTimes(1)
    act(() => {
      jest.advanceTimersByTime(14_999)
    })
    expect(onPaid).toHaveBeenCalledTimes(1) // 15s not reached yet
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(onPaid).toHaveBeenCalledTimes(2) // 15s tick fires
  })

  it('polling caps at 30s after 4th tick onward', () => {
    const onPaid = jest.fn()
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    act(() => {
      jest.advanceTimersByTime(10_000)
    }) // tick 1 (+10s)
    act(() => {
      jest.advanceTimersByTime(15_000)
    }) // tick 2 (+15s)
    act(() => {
      jest.advanceTimersByTime(20_000)
    }) // tick 3 (+20s)
    expect(onPaid).toHaveBeenCalledTimes(3)
    act(() => {
      jest.advanceTimersByTime(30_000)
    }) // tick 4 (capped at 30s)
    expect(onPaid).toHaveBeenCalledTimes(4)
    act(() => {
      jest.advanceTimersByTime(30_000)
    }) // tick 5 (still 30s)
    expect(onPaid).toHaveBeenCalledTimes(5)
  })

  it('stops polling when orderStatus transitions to PAID', () => {
    const onPaid = jest.fn()
    const { rerender } = renderHook(
      ({ orderStatus }: { orderStatus: OrderStatus | undefined }) =>
        usePaymentStatusDetector({
          ...base,
          method: PaymentMethod.BANK_TRANSFER,
          submittedAt: 1_000_000,
          orderStatus,
          onPaid,
        }),
      {
        initialProps: {
          orderStatus: OrderStatus.PENDING as OrderStatus | undefined,
        },
      },
    )
    act(() => {
      jest.advanceTimersByTime(10_000)
    })
    expect(onPaid).toHaveBeenCalledTimes(1) // first tick fired
    // Simulate refetch returning PAID
    rerender({ orderStatus: OrderStatus.PAID })
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    // No more polling ticks after success
    expect(onPaid).toHaveBeenCalledTimes(1)
  })
})

// ── FCM sync applies to every method ─────────────────────────────────────────
// Đơn có thể được người khác trả (QR xu) trong lúc chủ đơn chưa gửi gì hoặc
// đang chọn phương thức khác.
describe('FCM sync for any method', () => {
  const paid = {
    slug: 'n1',
    isRead: false,
    message: NotificationMessageCode.ORDER_PAID,
    metadata: { order: 'order-1' },
  }

  it('calls onPaid when nothing was submitted (method = null)', () => {
    const onPaid = jest.fn()
    setNotifications([paid])
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: null,
        submittedAt: null,
        onPaid,
      }),
    )
    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('calls onPaid when CASH is selected', () => {
    const onPaid = jest.fn()
    setNotifications([paid])
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.CASH,
        submittedAt: 1_000_000,
        onPaid,
      }),
    )
    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('calls onPaid once when the notification arrives after mount', () => {
    const onPaid = jest.fn()
    const { rerender } = renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: null,
        submittedAt: null,
        onPaid,
      }),
    )
    expect(onPaid).not.toHaveBeenCalled()

    setNotifications([paid])
    rerender({})
    rerender({})

    expect(onPaid).toHaveBeenCalledTimes(1)
  })
})

// ── Quay về từ app ngân hàng (AppState) ──────────────────────────────────────
// Chuyển khoản xong khách quay về app: hỏi lại ngay, không chờ tới 30s. Khi
// app chạy nền: không gọi mạng liên tục.
describe('BANK_TRANSFER — AppState', () => {
  let listener: ((s: AppStateStatus) => void) | null = null
  const remove = jest.fn()
  beforeEach(() => {
    listener = null
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      listener = cb as (s: AppStateStatus) => void
      return { remove } as unknown as ReturnType<
        typeof AppState.addEventListener
      >
    })
  })

  const start = () =>
    renderHook(() =>
      usePaymentStatusDetector({
        ...base,
        method: PaymentMethod.BANK_TRANSFER,
        submittedAt: 1,
      }),
    )

  it('quay lại app (active): hỏi lại ngay và đặt lại nhịp 10s', () => {
    start()
    act(() => jest.advanceTimersByTime(25_000)) // 10s + 15s → 2 lần
    expect(base.onPaid).toHaveBeenCalledTimes(2)
    act(() => listener?.('background'))
    act(() => listener?.('active'))
    expect(base.onPaid).toHaveBeenCalledTimes(3)
    act(() => jest.advanceTimersByTime(10_000)) // nhịp lại từ 10s
    expect(base.onPaid).toHaveBeenCalledTimes(4)
  })

  it('chạy nền: không hỏi trạng thái', () => {
    start()
    act(() => listener?.('background'))
    act(() => jest.advanceTimersByTime(60_000))
    expect(base.onPaid).not.toHaveBeenCalled()
  })

  it('gỡ lắng nghe khi thôi theo dõi', () => {
    const { unmount } = start()
    unmount()
    expect(remove).toHaveBeenCalled()
  })
})
