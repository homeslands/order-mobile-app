import { useCallback, useRef, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'

/**
 * Chiều cao đo được qua onLayout, làm tròn lên pt nguyên. Chỉ setState khi
 * chiều cao thật sự đổi — setState cùng giá trị vẫn có thể làm React render
 * thêm một lượt.
 */
export function useLayoutHeight() {
  const [height, setHeight] = useState(0)
  const heightRef = useRef(0)
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.ceil(e.nativeEvent.layout.height)
    if (next === heightRef.current) return
    heightRef.current = next
    setHeight(next)
  }, [])
  return [height, onLayout] as const
}
