import { act, renderHook } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'

import { useGlassEnabled, useReduceTransparency } from '@/hooks/use-glass'

// Cờ "máy có kính" đọc qua getter nên đổi được giữa các test mà không phải
// nạp lại module — nạp lại sẽ kéo theo bản React thứ hai và hook gãy.
let mockHasGlass = true
jest.mock('@/utils/liquid-glass', () => ({
  get HAS_LIQUID_GLASS() {
    return mockHasGlass
  },
}))

let emitChange: ((value: boolean) => void) | undefined
const removeListener = jest.fn()

jest
  .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
  .mockImplementation(() => Promise.resolve(false))
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

beforeEach(() => {
  mockHasGlass = true
})

describe('useGlassEnabled', () => {
  it('máy có kính, không bật trợ năng: bật kính', async () => {
    const { result } = renderHook(() => useGlassEnabled())
    await act(async () => {})
    expect(result.current).toBe(true)
  })

  it('máy không có kính: luôn tắt', async () => {
    mockHasGlass = false
    const { result } = renderHook(() => useGlassEnabled())
    await act(async () => {})
    expect(result.current).toBe(false)
  })

  it('bật Giảm độ trong suốt giữa chừng: tắt ngay, tắt lại thì bật lại', async () => {
    const { result } = renderHook(() => useGlassEnabled())
    await act(async () => {})
    expect(result.current).toBe(true)

    await act(async () => {
      emitChange?.(true)
    })
    expect(result.current).toBe(false)

    await act(async () => {
      emitChange?.(false)
    })
    expect(result.current).toBe(true)
  })
})

describe('useReduceTransparency', () => {
  it('phản ánh cài đặt trợ năng', async () => {
    const { result } = renderHook(() => useReduceTransparency())
    await act(async () => {})

    await act(async () => {
      emitChange?.(true)
    })
    expect(result.current).toBe(true)

    await act(async () => {
      emitChange?.(false)
    })
    expect(result.current).toBe(false)
  })

  it('gỡ listener khi unmount', async () => {
    const { unmount } = renderHook(() => useReduceTransparency())
    await act(async () => {})
    unmount()
    expect(removeListener).toHaveBeenCalled()
  })
})
