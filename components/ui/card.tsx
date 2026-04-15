import { cn } from '@/lib/utils'
import { ComponentProps } from 'react'
import { Text, View } from 'react-native'

interface CardProps extends ComponentProps<typeof View> {
  children: React.ReactNode
}

interface CardHeaderProps extends ComponentProps<typeof View> {
  children: React.ReactNode
}

interface CardTitleProps extends ComponentProps<typeof Text> {
  children: React.ReactNode
}

interface CardDescriptionProps extends ComponentProps<typeof Text> {
  children: React.ReactNode
}

interface CardContentProps extends ComponentProps<typeof View> {
  children: React.ReactNode
}

interface CardFooterProps extends ComponentProps<typeof View> {
  children: React.ReactNode
}

function Card({ children, className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </View>
  )
}

function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <View className={cn('flex-col gap-1.5 p-6', className)} {...props}>
      {children}
    </View>
  )
}

function CardTitle({ children, className, ...props }: CardTitleProps) {
  return (
    <Text
      className={cn(
        'text-2xl font-semibold text-gray-900 dark:text-white',
        className
      )}
      {...props}
    >
      {children}
    </Text>
  )
}

function CardDescription({ children, className, ...props }: CardDescriptionProps) {
  return (
    <Text
      className={cn('text-sm text-gray-600 dark:text-gray-400', className)}
      {...props}
    >
      {children}
    </Text>
  )
}

function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <View className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </View>
  )
}

function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <View className={cn('flex-row items-center p-6 pt-0', className)} {...props}>
      {children}
    </View>
  )
}

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter

export { Card }
