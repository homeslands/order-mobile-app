import React, { useState } from 'react'
import { Text, TextProps } from 'react-native'

interface StaticTextProps extends Omit<TextProps, 'children'> {
  /** Key để so sánh — khi đổi product (slug) mới mount lại. Tránh diff khi size/quantity thay đổi. */
  contentKey: string
  /** Nội dung văn bản — khởi tạo một lần duy nhất, không cập nhật khi parent re-render. */
  children: string
}

/**
 * StaticText — Khởi tạo nội dung một lần duy nhất theo contentKey.
 * Triệt tiêu React diffing khối văn bản dài khi parent re-render (chọn size, đổi số lượng).
 * Parent dùng key={contentKey} để remount khi chuyển sản phẩm.
 */
export const StaticText = React.memo(
  function StaticText({ children, ...textProps }: StaticTextProps) {
    const [text] = useState(children)
    return <Text {...textProps}>{text}</Text>
  },
  (prev, next) => prev.contentKey === next.contentKey,
)
