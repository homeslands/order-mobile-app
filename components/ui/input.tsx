import { cn } from '@/lib/utils'
import { colors } from '@/constants'
import { ComponentProps, forwardRef } from 'react'
import { TextInput, useColorScheme } from 'react-native'

interface InputProps extends ComponentProps<typeof TextInput> {
  error?: boolean
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ className, error, ...props }, ref) => {
    const colorScheme = useColorScheme()

    return (
      <TextInput
        ref={ref}
        className={cn(
          'h-10 rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 text-base',
          'text-gray-900 dark:text-white',
          'border-gray-200 dark:border-gray-700',
          error && 'border-destructive',
          'placeholder:text-gray-500 dark:placeholder:text-gray-400',
          className
        )}
        style={{ fontFamily: 'BeVietnamPro_400Regular' }}
        placeholderTextColor={colorScheme === 'dark' ? colors.mutedForeground.dark : colors.mutedForeground.light}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
