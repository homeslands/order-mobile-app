import { act, renderHook } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'

import { useLiquidGlass } from '@/hooks/use-liquid-glass'

// Cờ "máy có kính" đọc qua getter nên đổi được giữa các test mà không phải
// nạp lại module — nạp lại sẽ kéo theo bản React thứ hai và hook gãy.
let mockHasGlass = true
jest.mock('@/utils/liquid-glass', () => ({
  get HAS_LIQUID_GLASS() {
    return mockHasGlass
  },
}))

// Hệ thống chỉ trả lời "đang bật Reduce Transparency?" một lần, ở lần
// subscribe đầu tiên. Các test sau đổi trạng thái qua sự kiện, đúng như khi
// người dùng bật tắt trong Cài đặt lúc app đang chạy.
let initialReduceTransparency = false
let emitChange: ((value: boolean) => void) | undefined
const removeListener = jest.fn()

jest
  .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
  .mockImplementation(() => Promise.resolve(initialReduceTransparency))
// jest.spyOn suy ra kiểu từ overload đầu tiên của addEventListener
// (announcementFinished), nên phải ép kiểu về đúng overload đang dùng
// (reduceTransparencyChanged) để tsc không báo sai kiểu tham số.
const addEventListener = jest.spyOn(
  AccessibilityInfo,
  'addEventListener',
) as unknown as jest.SpyInstance<
  { remove: () => void },
  [string, (value: boolean) => void]
>

addEventListener.mockImplementation((event, handler) => {
  if (event === 'reduceTransparencyChanged') {
    emitChange = handler
  }
  return { remove: removeListener }
})

describe('useLiquidGlass', () => {
  // Thứ tự các test có ý nghĩa: test đầu tiên là lần subscribe đầu tiên, nơi
  // duy nhất hook đọc cài đặt ban đầu.
  it('đang bật Reduce Transparency sẵn thì tắt kính sau khi đọc xong cài đặt', async () => {
    initialReduceTransparency = true
    const { result } = renderHook(() => useLiquidGlass())

    await act(async () => {})

    expect(result.current).toBe(false)
  })

  it('tắt Reduce Transparency trong lúc đang dùng app thì bật lại kính', async () => {
    const { result } = renderHook(() => useLiquidGlass())
    await act(async () => {})

    await act(async () => {
      emitChange?.(false)
    })
    expect(result.current).toBe(true)

    await act(async () => {
      emitChange?.(true)
    })
    expect(result.current).toBe(false)
  })

  it('máy không có Liquid Glass thì luôn false, kể cả khi tắt Reduce Transparency', async () => {
    mockHasGlass = false
    const { result } = renderHook(() => useLiquidGlass())
    await act(async () => {})

    await act(async () => {
      emitChange?.(false)
    })
    expect(result.current).toBe(false)

    mockHasGlass = true
  })

  it('gỡ listener của hệ thống khi component unmount', async () => {
    removeListener.mockClear()
    const { unmount } = renderHook(() => useLiquidGlass())
    await act(async () => {})

    unmount()

    expect(removeListener).toHaveBeenCalled()
  })
})
