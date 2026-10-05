// Hook dùng chung ba lối vào QR: ma trận auth (A/B/C), guard chạm trùng (D),
// auth đọc tại thời điểm chạm (E), close() vô hại khi sheet chưa mở (F).
import { act, renderHook } from '@testing-library/react-native'

import { useQrActions } from '@/hooks/use-qr-actions'
import { scheduleTransitionTask } from '@/lib/navigation'
import { useQRSelectionSheetStore } from '@/stores/qr-selection-sheet.store'
import { useScanSheetStore } from '@/stores/scan-sheet.store'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/lib/navigation', () => ({
  scheduleTransitionTask: jest.fn(),
}))

let mockAuthed = true
jest.mock('@/stores', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: () => mockAuthed }) },
}))

// Hai store sheet dùng bản THẬT — test cần đọc `visible` để chứng minh
// sheet nào được mở/đóng.

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthed = true
  useQRSelectionSheetStore.setState({ visible: true })
  useScanSheetStore.setState({ visible: false })
})

/** Chạy task đã lên lịch — push chỉ xảy ra khi task được gọi. */
function runScheduledTask() {
  expect(scheduleTransitionTask).toHaveBeenCalledTimes(1)
  expect(mockPush).not.toHaveBeenCalled()
  const task = jest.mocked(scheduleTransitionTask).mock.calls[0][0]
  act(() => {
    task()
  })
}

describe('useQrActions', () => {
  it('A1 memberId đã đăng nhập: mở scan sheet, đóng sheet chọn, không push', () => {
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openMemberId()
    })
    expect(useScanSheetStore.getState().visible).toBe(true)
    expect(useQRSelectionSheetStore.getState().visible).toBe(false)
    expect(scheduleTransitionTask).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('A2 memberId chưa đăng nhập: đi login, KHÔNG mở scan sheet', () => {
    mockAuthed = false
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openMemberId()
    })
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
    // Quan trọng: ScanSheetPortal mount toàn cục — nếu mở, nó bật lên chồng
    // trên màn login với ô QR rỗng.
    expect(useScanSheetStore.getState().visible).toBe(false)
  })

  it('B1 coinPayment đã đăng nhập: push /payment/qr-generate', () => {
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openCoinPayment()
    })
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/payment/qr-generate')
    expect(useQRSelectionSheetStore.getState().visible).toBe(false)
  })

  it('B2 coinPayment chưa đăng nhập: push /auth/login', () => {
    mockAuthed = false
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openCoinPayment()
    })
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })

  it('C1 scanPay đã đăng nhập: push /payment/scan-point', () => {
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openScanPay()
    })
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/payment/scan-point')
  })

  it('C2 scanPay chưa đăng nhập: push /auth/login', () => {
    mockAuthed = false
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openScanPay()
    })
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })

  it('D1 double-tap cùng một tile chỉ đi một lần', () => {
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openCoinPayment()
      result.current.openCoinPayment()
    })
    expect(scheduleTransitionTask).toHaveBeenCalledTimes(1)
  })

  it('D2 chạm nhanh hai tile khác nhau chỉ đi một lần', () => {
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openCoinPayment()
      result.current.openScanPay()
    })
    expect(scheduleTransitionTask).toHaveBeenCalledTimes(1)
  })

  it('E1 đăng xuất sau khi render: chạm vẫn đi login', () => {
    const { result } = renderHook(() => useQrActions())
    // Đăng xuất SAU khi hook đã render — nếu auth bị đọc lúc render thì
    // test này đi /payment/qr-generate và đỏ.
    mockAuthed = false
    act(() => {
      result.current.openCoinPayment()
    })
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })

  it('F1 vào từ Home khi sheet chọn chưa mở: không lỗi, visible vẫn false', () => {
    useQRSelectionSheetStore.setState({ visible: false })
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openScanPay()
    })
    expect(useQRSelectionSheetStore.getState().visible).toBe(false)
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/payment/scan-point')
  })
})
