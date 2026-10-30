import { useFocusEffect } from '@react-navigation/native'
import { startTransition, useCallback, useState } from 'react'
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
 *
 * `hasCachedData` chỉ được đọc ở render đầu.
 */
export function useEntryFetchGate(hasCachedData: boolean): boolean {
  const [open, setOpen] = useState(() => !hasCachedData)

  useFocusEffect(
    useCallback(() => {
      if (open) return
      const task = InteractionManager.runAfterInteractions(() => {
        startTransition(() => setOpen(true))
      })
      return () => task.cancel()
    }, [open]),
  )

  return open
}
