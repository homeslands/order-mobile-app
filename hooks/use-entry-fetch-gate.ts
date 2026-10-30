import { useFocusEffect } from '@react-navigation/native'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { InteractionManager } from 'react-native'

/**
 * Cổng `enabled` cho query chính của một màn danh sách khi vào màn.
 *
 * - Chưa có cache: mở NGAY từ render đầu. Request mạng là bất đồng bộ, không
 *   tốn JS thread lúc chuyển màn; chờ hết chuyển màn chỉ cộng thêm độ trễ.
 * - Có cache: dữ liệu đã hiện sẵn, chỉ lần làm mới được hoãn tới sau chuyển
 *   màn để kết quả về không chen vào khung hình của animation.
 * - Đã mở thì giữ mở: đóng khi rời màn rồi mở lại là thêm lượt render cả màn
 *   mỗi lần quay lại.
 * - Quay lại màn (từ lần focus thứ hai) với `refreshKey`: sau chuyển màn, làm
 *   mới các query đang dùng mà đã cũ dưới key đó. App tắt refetchOnWindowFocus
 *   và các query danh sách tắt refetchOnMount, nên đây là đường làm mới tự
 *   động duy nhất khi khách quay lại tab.
 *
 * `hasCachedData` chỉ được đọc ở render đầu.
 */
export function useEntryFetchGate(
  hasCachedData: boolean,
  refreshKey?: QueryKey,
): boolean {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(() => !hasCachedData)
  // Đọc trong callback qua ref: callback đổi theo `open` sẽ làm useFocusEffect
  // chạy lại và tính nhầm lần mở cổng là một lần "quay lại màn".
  const openRef = useRef(open)
  const focusCountRef = useRef(0)
  const refreshKeyRef = useRef(refreshKey)
  useEffect(() => {
    refreshKeyRef.current = refreshKey
  })

  useFocusEffect(
    useCallback(() => {
      focusCountRef.current += 1
      const isReturn = focusCountRef.current > 1
      if (openRef.current && !isReturn) return
      const task = InteractionManager.runAfterInteractions(() => {
        if (!openRef.current) {
          openRef.current = true
          startTransition(() => setOpen(true))
          return
        }
        const key = refreshKeyRef.current
        if (key) {
          void queryClient.refetchQueries({
            queryKey: key,
            stale: true,
            type: 'active',
          })
        }
      })
      return () => task.cancel()
    }, [queryClient]),
  )

  return open
}
