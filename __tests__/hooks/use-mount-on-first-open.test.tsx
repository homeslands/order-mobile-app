// Bottom sheet chỉ dựng khi được mở lần đầu, rồi giữ mount: đóng vẫn có
// animation, mở lần sau tức thì. Trước đây cả 7 sheet của giỏ hàng (kèm query,
// mutation, ~15 hook mỗi sheet) dựng cùng lúc ngay khi vào giỏ.
import { renderHook } from '@testing-library/react-native'

import { useMountOnFirstOpen } from '@/hooks/use-mount-on-first-open'

it('MO1 chưa mở thì chưa dựng; mở rồi thì giữ', () => {
  const { result, rerender } = renderHook(
    ({ visible }: { visible: boolean }) => useMountOnFirstOpen(visible),
    { initialProps: { visible: false } },
  )
  expect(result.current).toBe(false)
  rerender({ visible: true })
  expect(result.current).toBe(true)
  rerender({ visible: false })
  expect(result.current).toBe(true)
})

it('MO2 mở ngay từ đầu thì dựng ngay ở render đầu', () => {
  const { result } = renderHook(() => useMountOnFirstOpen(true))
  expect(result.current).toBe(true)
})
