import { forwardRef } from 'react'
import { StyleSheet, Text as RNText, type TextProps } from 'react-native'

import { useFontScale } from '@/providers/font-scale-provider'

export type AppTextProps = TextProps

export const Text = forwardRef<RNText, AppTextProps>(function Text(props, ref) {
  const scale = useFontScale()

  if (scale === 1) {
    return <RNText maxFontSizeMultiplier={1.2} {...props} ref={ref} />
  }

  const flat = StyleSheet.flatten(props.style) as { fontSize?: number } | null
  const baseFontSize = flat?.fontSize ?? 14
  const scaledStyle = [props.style, { fontSize: baseFontSize * scale }]

  return (
    <RNText
      maxFontSizeMultiplier={1.2}
      {...props}
      style={scaledStyle}
      ref={ref}
    />
  )
})

Text.displayName = 'Text'
