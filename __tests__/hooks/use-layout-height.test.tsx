// Thanh tổng tiền của giỏ cao 220–270pt + inset tuỳ loại đơn, trong khi danh
// sách chừa cố định 200 → che ô ghi chú và món cuối. Đo chiều cao thật bằng
// onLayout; chỉ re-render khi chiều cao (làm tròn) thật sự đổi.
import { act, renderHook } from '@testing-library/react-native'
import type { LayoutChangeEvent } from 'react-native'

import { useLayoutHeight } from '@/hooks/use-layout-height'

function layout(height: number): LayoutChangeEvent {
  return {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
  } as LayoutChangeEvent
}

it('LH1 chưa đo thì 0; đo xong trả chiều cao làm tròn lên', () => {
  const { result } = renderHook(() => useLayoutHeight())
  expect(result.current[0]).toBe(0)
  act(() => result.current[1](layout(250.3)))
  expect(result.current[0]).toBe(251)
})

it('LH2 cùng chiều cao (kể cả lệch dưới 1pt) thì không re-render', () => {
  let renders = 0
  const { result } = renderHook(() => {
    renders++
    return useLayoutHeight()
  })
  act(() => result.current[1](layout(250.3)))
  const after = renders
  act(() => result.current[1](layout(250.3)))
  act(() => result.current[1](layout(250.9)))
  expect(renders).toBe(after)
})

it('LH3 chiều cao đổi thật (đổi loại đơn) thì cập nhật; onLayout giữ tham chiếu', () => {
  const { result } = renderHook(() => useLayoutHeight())
  const onLayout = result.current[1]
  act(() => onLayout(layout(220)))
  act(() => onLayout(layout(270)))
  expect(result.current[0]).toBe(270)
  expect(result.current[1]).toBe(onLayout)
})
