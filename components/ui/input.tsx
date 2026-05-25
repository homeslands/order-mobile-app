import { cn } from '@/lib/utils'
import { colors } from '@/constants'
import { ComponentProps, forwardRef } from 'react'
import { StyleSheet, TextInput, useColorScheme } from 'react-native'

import { useFontScale } from '@/providers/font-scale-provider'

interface InputProps extends ComponentProps<typeof TextInput> {
  error?: boolean
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ className, error, style, ...props }, ref) => {
    const colorScheme = useColorScheme()
    const scale = useFontScale()

    return (
      <TextInput
        ref={ref}
        className={cn(
          'h-10 rounded-lg border bg-white px-3 py-2 text-base dark:bg-[#121212]',
          'text-gray-900 dark:text-white',
          'border-gray-200 dark:border-[#2e2e2e]',
          error && 'border-destructive',
          'placeholder:text-gray-500 dark:placeholder:text-gray-400',
          className,
        )}
        style={[
          { fontFamily: 'BeVietnamPro_400Regular', fontSize: 16 * scale },
          StyleSheet.flatten(style),
        ]}
        placeholderTextColor={
          colorScheme === 'dark'
            ? colors.mutedForeground.dark
            : colors.mutedForeground.light
        }
        {...props}
        allowFontScaling={false}
      />
    )
  },
)

Input.displayName = 'Input'
