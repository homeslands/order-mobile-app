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

// Hai vị từ, không phải một: `isAuthenticated()` trả false trong SUỐT lúc
// refresh token đang bay (auth.store.ts:41 → `!isRefreshing`), còn
// `isTokenValid()` cùng logic nhưng không đọc `isRefreshing`.
const mockAuth = { authed: true, tokenValid: true }
jest.mock('@/stores', () => ({
  useAuthStore: {
    getState: () => ({
      isAuthenticated: () => mockAuth.authed,
      isTokenValid: () => mockAuth.tokenValid,
    }),
  },
}))

/** Đăng xuất thật: không token nào dùng được. */
function setLoggedOut() {
  mockAuth.authed = false
  mockAuth.tokenValid = false
}

/** Access token hết hạn, refresh token còn hạn, refresh đang bay. */
function setRefreshing() {
  mockAuth.authed = false
  mockAuth.tokenValid = true
}

// Hai store sheet dùng bản THẬT — test cần đọc `visible` để chứng minh
// sheet nào được mở/đóng.

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.authed = true
  mockAuth.tokenValid = true
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
    setLoggedOut()
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
    setLoggedOut()
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
    setLoggedOut()
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
    setLoggedOut()
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
  it('G1 memberId chưa đăng nhập: ĐÓNG sheet chọn trước khi sang login', () => {
    // Nếu không đóng, `/auth/login` bị push XUỐNG DƯỚI sheet đang mở
    // (QRSelectionSheet mount ở app/_layout.tsx:131, ngoài stack navigator
    // nên vẽ trên mọi screen). Khách thấy sheet y nguyên, tưởng chạm không ăn.
    setLoggedOut()
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openMemberId()
    })
    expect(useQRSelectionSheetStore.getState().visible).toBe(false)
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })

  it('H1 đang refresh token: coinPayment vẫn đi đích thật, không đẩy sang login', () => {
    // Mở app ở quầy sáng hôm sau: access token hết hạn, refresh còn hạn,
    // interceptor đang refresh (http.ts:127). Khách VẪN đang đăng nhập.
    setRefreshing()
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openCoinPayment()
    })
    runScheduledTask()
    expect(mockPush).toHaveBeenCalledWith('/payment/qr-generate')
  })

  it('H2 đang refresh token: memberId vẫn mở được mã, không cần mạng', () => {
    setRefreshing()
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openMemberId()
    })
    expect(useScanSheetStore.getState().visible).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('I1 đồng hồ hệ thống lùi: cú chạm sau vẫn được nhận', () => {
    // NTP hoặc người dùng kéo đồng hồ lùi. Nếu guard chỉ so `now - last < 600`
    // thì hiệu âm cũng < 600 → cả ba tile im lặng không làm gì cho tới khi
    // đồng hồ chạy vượt mốc cũ, và ref không bao giờ tự chữa.
    const nowSpy = jest.spyOn(Date, 'now')
    nowSpy.mockReturnValue(10_000_000)
    const { result } = renderHook(() => useQrActions())
    act(() => {
      result.current.openCoinPayment()
    })
    expect(scheduleTransitionTask).toHaveBeenCalledTimes(1)

    jest.mocked(scheduleTransitionTask).mockClear()
    nowSpy.mockReturnValue(10_000_000 - 3_600_000) // lùi 1 giờ
    act(() => {
      result.current.openScanPay()
    })
    expect(scheduleTransitionTask).toHaveBeenCalledTimes(1)
    nowSpy.mockRestore()
  })
})
