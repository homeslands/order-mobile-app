import { useState } from 'react'

/**
 * `false` cho tới lần đầu `visible` là `true`, sau đó `true` mãi.
 *
 * Dùng để chỉ dựng một bottom sheet khi nó được mở lần đầu (`{mounted && <Sheet/>}`)
 * thay vì dựng sẵn mọi sheet — kèm query, mutation và hàng chục hook — ngay khi
 * vào màn. Giữ mount sau lần mở đầu để đóng vẫn có animation và mở lần sau tức
 * thì. Sheet phải tự `present()` trong effect theo `visible` (chạy cả lúc mount).
 */
export function useMountOnFirstOpen(visible: boolean): boolean {
  const [mounted, setMounted] = useState(visible)
  // Đặt state trong render (mẫu "điều chỉnh state theo prop" của React): sheet
  // có mặt ngay trong lần render mà visible chuyển sang true, không trễ một nhịp.
  if (visible && !mounted) setMounted(true)
  return mounted || visible
}
