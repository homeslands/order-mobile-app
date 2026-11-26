import { useCallback, useRef, useState } from 'react'

/**
 * Chạy một việc async mỗi lần một lượt: gọi lại khi lượt trước chưa xong thì
 * bỏ qua. Khoá bằng ref (đồng bộ) vì hai lần bấm sát nhau có thể tới trước khi
 * state kịp re-render nút thành disabled.
 */
export function useSingleFlight(task: () => Promise<void>) {
  const runningRef = useRef(false)
  const [isRunning, setIsRunning] = useState(false)

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setIsRunning(true)
    try {
      await task()
    } finally {
      runningRef.current = false
      setIsRunning(false)
    }
  }, [task])

  return { run, isRunning }
}
