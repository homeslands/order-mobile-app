import { cn, variants } from '@/lib/utils'
import { ComponentProps } from 'react'
import { Text, View } from 'react-native'

interface BadgeProps extends ComponentProps<typeof View> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  children: React.ReactNode
}

const badgeVariants = variants('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', {
  default: 'border-transparent bg-gray-900 dark:bg-gray-50 text-gray-50 dark:text-gray-900',
  secondary: 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50',
  destructive: 'border-transparent bg-red-600 dark:bg-red-700 text-white',
  outline: 'text-gray-900 dark:text-gray-50 border-gray-200 dark:border-gray-700',
})

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants(variant), className)} {...props}>
      <Text
        className={cn(
          'font-semibold text-xs',
          variant === 'default' && 'text-gray-50 dark:text-gray-900',
          variant === 'secondary' && 'text-gray-900 dark:text-gray-50',
          variant === 'destructive' && 'text-white',
          variant === 'outline' && 'text-gray-900 dark:text-gray-50'
        )}
      >
        {children}
      </Text>
    </View>
  )
}
