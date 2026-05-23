import { forwardRef } from 'react'
import { StyleSheet, Text as RNText, type TextProps } from 'react-native'

import { useFontScale } from '@/providers/font-scale-provider'

export type AppTextProps = TextProps

// Standard Tailwind text-* → point values (rem × 16, default Tailwind scale)
const TAILWIND_FONT_SIZES: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
  'text-5xl': 48,
}

// Handles arbitrary values like text-[15px] or text-[15]
const ARBITRARY_TEXT_RE = /\btext-\[(\d+(?:\.\d+)?)(px)?\]/

function fontSizeFromClassName(className: string | undefined): number | undefined {
  if (!className) return undefined
  for (const cls of className.split(/\s+/)) {
    const standard = TAILWIND_FONT_SIZES[cls]
    if (standard !== undefined) return standard
    const m = ARBITRARY_TEXT_RE.exec(cls)
    if (m) return parseFloat(m[1])
  }
  return undefined
}

export const Text = forwardRef<RNText, AppTextProps>(function Text(props, ref) {
  const scale = useFontScale()

  const flat = StyleSheet.flatten(props.style) as { fontSize?: number } | null
  const baseFontSize =
    flat?.fontSize ?? fontSizeFromClassName(props.className) ?? 14
  const scaledStyle = [props.style, { fontSize: baseFontSize * scale }]

  return (
    <RNText
      {...props}
      allowFontScaling={false}
      style={scaledStyle}
      ref={ref}
    />
  )
})

Text.displayName = 'Text'
