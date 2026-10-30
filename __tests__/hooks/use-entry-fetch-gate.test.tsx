// Cổng gọi API khi vào màn danh sách. Chưa có cache thì phải gọi NGAY — chờ
// hết hiệu ứng chuyển màn chỉ cộng thêm độ trễ trước khi request đi. Có cache
// thì dữ liệu đã hiện sẵn, lần làm mới mới được hoãn qua chuyển màn. Đã mở thì
// không đóng lại khi rời màn (mỗi lần đóng/mở là thêm lượt render cả màn).
import { act, renderHook } from '@testing-library/react-native'
import { InteractionManager } from 'react-native'

import { useEntryFetchGate } from '@/hooks/use-entry-fetch-gate'

let mockFocusCleanup: (() => void) | void
let mockFocusEffect: (() => (() => void) | void) | null = null
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react')
    mockFocusEffect = cb
    useEffect(() => {
      mockFocusCleanup = cb()
      return () => mockFocusCleanup?.()
    }, [cb])
  },
}))

let pendingInteractions: Array<() => void> = []

beforeEach(() => {
  pendingInteractions = []
  jest
    .spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation((task) => {
      pendingInteractions.push(task as () => void)
      return {
        then: () => Promise.resolve(),
        done: () => {},
        cancel: () => {},
      } as unknown as ReturnType<typeof InteractionManager.runAfterInteractions>
    })
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('EG1 chưa có cache: mở ngay ở render đầu, không chờ chuyển màn', () => {
  const { result } = renderHook(() => useEntryFetchGate(false))
  expect(result.current).toBe(true)
  expect(pendingInteractions).toHaveLength(0)
})

it('EG2 có cache: đóng tới khi chuyển màn xong', () => {
  const { result } = renderHook(() => useEntryFetchGate(true))
  expect(result.current).toBe(false)
  act(() => pendingInteractions.forEach((t) => t()))
  expect(result.current).toBe(true)
})

it('EG3 đã mở thì rời màn rồi quay lại vẫn mở', () => {
  const seen: boolean[] = []
  const { result } = renderHook(() => {
    const open = useEntryFetchGate(true)
    seen.push(open)
    return open
  })
  act(() => pendingInteractions.forEach((t) => t()))
  expect(result.current).toBe(true)
  const before = seen.length
  act(() => {
    mockFocusCleanup?.()
    mockFocusCleanup = mockFocusEffect?.()
  })
  expect(result.current).toBe(true)
  expect(seen.slice(before)).not.toContain(false)
})
