// NativeGesturePressable giữ một khoá điều hướng DÙNG CHUNG toàn app
// (isLockedShared). Khoá đó chỉ được mở bởi engine điều hướng — qua
// executeNavFromGesture → lockNavigation/scheduleUnlock khi có prop
// `navigation` — hoặc bởi transitionEnd của một màn mới. Nếu chỉ truyền
// `onPress` mà vẫn khoá, hành động không tạo transition (mở sheet, chuyển
// tab, gọi điện) sẽ để khoá kẹt và mọi nút điều hướng khác trong app chết.
import 'react-native-gesture-handler/jestSetup'

import { act, render } from '@testing-library/react-native'
import { View } from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'

import { NativeGesturePressable } from '@/components/navigation/native-gesture-pressable'
import { isLockedShared } from '@/lib/navigation/navigation-lock-shared'

const mockExecuteNav = jest.fn()

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

// Mock của reanimated cho `makeMutable` là hàm trả lại đối số, nên khoá thật
// trong test chỉ là số 0 trần — gán `.value` không có tác dụng và khoá vô
// hiệu. Dựng lại thành một ô giá trị, đúng như shared value trên máy.
jest.mock('@/lib/navigation/navigation-lock-shared', () => ({
  isLockedShared: { value: 0 },
}))

jest.mock('@/lib/navigation', () => ({
  executeNavFromGesture: (...args: unknown[]) => mockExecuteNav(...args),
}))

const TAP = [
  { state: State.BEGAN },
  { state: State.ACTIVE },
  { state: State.END },
]

async function tap() {
  fireGestureHandler(getByGestureTestId('native-gesture-pressable'), TAP)
  // onPress chạy qua setImmediate
  await act(async () => {
    await new Promise((r) => setImmediate(r))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  isLockedShared.value = 0
})

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('NativeGesturePressable', () => {
  it('N1 chỉ có onPress: chạm lần hai vẫn ăn, khoá dùng chung không kẹt', async () => {
    const onPress = jest.fn()
    render(
      <NativeGesturePressable onPress={onPress}>
        <View />
      </NativeGesturePressable>,
    )
    await tap()
    await tap()
    expect(onPress).toHaveBeenCalledTimes(2)
    expect(isLockedShared.value).toBe(0)
  })

  it('N2 có navigation push: vẫn khoá để chặn chạm đúp trong lúc chuyển màn', async () => {
    // Khoá do engine mở (scheduleUnlock); ở đây engine bị mock nên khoá giữ
    // nguyên — đúng thứ chặn chạm thứ hai.
    render(
      <NativeGesturePressable navigation={{ type: 'push', href: '/x' }}>
        <View />
      </NativeGesturePressable>,
    )
    await tap()
    await tap()
    expect(mockExecuteNav).toHaveBeenCalledTimes(1)
    expect(isLockedShared.value).toBe(1)
  })
})
