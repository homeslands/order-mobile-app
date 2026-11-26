import { useCallback, useEffect, useRef, useState } from 'react'

import { OrderNoteInput } from '@/components/input'
import { useOrderFlowStore } from '@/stores'

const DEBOUNCE_NOTE_MS = 400

// Ghi chú đơn giữ cục bộ, ghi vào store sau khi ngừng gõ — trước mỗi phím gõ
// là một lần ghi store (vẽ lại danh sách, thanh dưới, sheet; ghi xuống máy).
// Giá trị đầu đọc một lần; bản nháp dựng lại thì cha đổi `key` để dựng lại ô.
export default function OrderNoteInUpdateOrderInput() {
  const setDraftDescription = useOrderFlowStore((s) => s.setDraftDescription)
  const initial = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.description ?? '',
  )
  const [value, setValue] = useState(initial)
  const pendingRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    if (pendingRef.current === null) return
    setDraftDescription(pendingRef.current)
    pendingRef.current = null
  }, [setDraftDescription])

  const handleChange = useCallback(
    (text: string) => {
      setValue(text)
      pendingRef.current = text
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, DEBOUNCE_NOTE_MS)
    },
    [flush],
  )

  // Rời màn / sang tab khác khi chưa hết debounce: ghi nốt, không mất chữ
  useEffect(() => {
    return () => flush()
  }, [flush])

  return <OrderNoteInput value={value} onChange={handleChange} onBlur={flush} />
}
