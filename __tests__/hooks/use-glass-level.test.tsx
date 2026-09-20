import { act, renderHook } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'

import {
  useGlassLevel,
  useGlassSupported,
  useReduceTransparency,
} from '@/hooks/use-glass-level'
import { useGlassStore } from '@/stores/glass.store'

// Cờ "máy có kính" đọc qua getter nên đổi được giữa các test mà không phải
// nạp lại module — nạp lại sẽ kéo theo bản React thứ hai và hook gãy.
let mockHasGlass = true
jest.mock('@/utils/liquid-glass', () => ({
  get HAS_LIQUID_GLASS() {
    return mockHasGlass
  },
}))

const initialReduceTransparency = false
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

beforeEach(() => {
  mockHasGlass = true
  useGlassStore.setState({ level: 1 })
})

describe('useGlassLevel', () => {
  it('máy có kính, không bật trợ năng: trả đúng mức trong store', async () => {
    const { result } = renderHook(() => useGlassLevel())
    await act(async () => {})
    expect(result.current).toBe(1)

    await act(async () => {
      useGlassStore.getState().setLevel(0.35)
    })
    expect(result.current).toBe(0.35)
  })

  it('máy không có kính: luôn 0 dù store khác', async () => {
    mockHasGlass = false
    useGlassStore.setState({ level: 0.8 })
    const { result } = renderHook(() => useGlassLevel())
    await act(async () => {})
    expect(result.current).toBe(0)
  })

  it('bật Reduce Transparency giữa chừng: về 0 ngay', async () => {
    const { result } = renderHook(() => useGlassLevel())
    await act(async () => {})
    expect(result.current).toBe(1)

    await act(async () => {
      emitChange?.(true)
    })
    expect(result.current).toBe(0)

    await act(async () => {
      emitChange?.(false)
    })
    expect(result.current).toBe(1)
  })
})

describe('useGlassSupported', () => {
  it('chỉ nói máy có hỗ trợ hay không, không quan tâm trợ năng', async () => {
    const { result } = renderHook(() => useGlassSupported())
    await act(async () => {})
    expect(result.current).toBe(true)

    await act(async () => {
      emitChange?.(true)
    })
    expect(result.current).toBe(true)

    mockHasGlass = false
    const second = renderHook(() => useGlassSupported())
    await act(async () => {})
    expect(second.result.current).toBe(false)
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

  it('gỡ listener của hệ thống khi component unmount', async () => {
    removeListener.mockClear()
    const { unmount } = renderHook(() => useReduceTransparency())
    await act(async () => {})

    unmount()

    expect(removeListener).toHaveBeenCalled()
  })
})
