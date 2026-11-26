// Nút "Đặt hàng" chờ kiểm menu + feature flag rồi mới mở sheet xác nhận. Bấm
// lần hai trong lúc đang kiểm thì phải bị bỏ qua — trước đây lượt thứ hai đi
// tiếp và mở sheet mà không chờ kiểm xong.
import { act, renderHook } from '@testing-library/react-native'

import { useSingleFlight } from '@/hooks/use-single-flight'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

it('SF1 đang chạy thì lượt gọi sau bị bỏ qua, isRunning bật/tắt đúng', async () => {
  const gate = deferred()
  const task = jest.fn(() => gate.promise)
  const { result } = renderHook(() => useSingleFlight(task))
  expect(result.current.isRunning).toBe(false)

  const staleRun = result.current.run
  let first!: Promise<void>
  act(() => {
    first = staleRun()
  })
  expect(result.current.isRunning).toBe(true)

  // Bấm lặp ngay trong lúc chờ — cả tham chiếu run cũ (chưa kịp re-render)
  // lẫn tham chiếu mới.
  await act(async () => {
    await staleRun()
    await result.current.run()
  })
  expect(task).toHaveBeenCalledTimes(1)

  await act(async () => {
    gate.resolve()
    await first
  })
  expect(result.current.isRunning).toBe(false)
})

it('SF2 xong lượt trước thì lượt sau chạy bình thường', async () => {
  const task = jest.fn(() => Promise.resolve())
  const { result } = renderHook(() => useSingleFlight(task))
  await act(() => result.current.run())
  await act(() => result.current.run())
  expect(task).toHaveBeenCalledTimes(2)
  expect(result.current.isRunning).toBe(false)
})

it('SF3 việc lỗi vẫn mở khoá để bấm lại được', async () => {
  const task = jest
    .fn<Promise<void>, []>()
    .mockRejectedValueOnce(new Error('net'))
    .mockResolvedValueOnce(undefined)
  const { result } = renderHook(() => useSingleFlight(task))
  await act(async () => {
    await expect(result.current.run()).rejects.toThrow('net')
  })
  expect(result.current.isRunning).toBe(false)
  await act(() => result.current.run())
  expect(task).toHaveBeenCalledTimes(2)
})
