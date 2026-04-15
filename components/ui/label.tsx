import { cn } from '@/lib/utils'
import { ComponentProps, forwardRef } from 'react'
import { Text } from 'react-native'

interface LabelProps extends ComponentProps<typeof Text> {
  /**
   * Whether the label is required (adds asterisk)
   */
  required?: boolean
  /**
   * Whether the label is disabled
   */
  disabled?: boolean
}

/**
 * Label component - similar to shadcn UI Label
 *
 * Used to render form labels with consistent styling.
 * Supports required indicator and disabled state.
 *
 * @example
 * ```tsx
 * <Label>Email</Label>
 * <Label required>Password</Label>
 * <Label disabled>Disabled Label</Label>
 * ```
 */
export const Label = forwardRef<Text, LabelProps>(
  (
    { className, required = false, disabled = false, children, ...props },
    ref,
  ) => {
    // const colorScheme = useColorScheme()
    // const isDark = colorScheme === 'dark'

    return (
      <Text
        ref={ref}
        className={cn(
          'text-sm font-medium',
          'leading-none',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          disabled && 'opacity-50',
          'text-gray-900 dark:text-gray-50',
          className,
        )}
        {...props}
      >
        {children}
        {required && (
          <Text className="ml-1 text-red-500 dark:text-red-400">*</Text>
        )}
      </Text>
    )
  },
)

Label.displayName = 'Label'
