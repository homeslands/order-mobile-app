import * as React from 'react'
import { Pressable, ScrollView, View } from 'react-native'

import { cn } from '@/lib/utils'

type ViewProps = React.ComponentPropsWithoutRef<typeof View>

const Table = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="w-full"
    >
      <View
        ref={ref}
        className={cn('w-full min-w-full', className)}
        {...props}
      />
    </ScrollView>
  )
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn('flex-row border-b border-gray-200 dark:border-gray-600', className)}
      {...props}
    />
  )
)
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('flex-1', className)} {...props} />
  )
)
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(
        'flex-row border-t border-gray-200 dark:border-gray-600 bg-gray-100/50 dark:bg-gray-800/50',
        className
      )}
      {...props}
    />
  )
)
TableFooter.displayName = 'TableFooter'

interface TableRowProps extends ViewProps {
  onPress?: () => void
}

const TableRow = React.forwardRef<View, TableRowProps>(
  ({ className, onPress, ...props }, ref) => {
    const rowClassName = cn(
      'flex-row border-b border-gray-200 dark:border-gray-600',
      onPress && 'active:opacity-70',
      className
    )
    if (onPress) {
      return (
        <Pressable
          ref={ref as React.RefObject<View>}
          className={rowClassName}
          onPress={onPress}
          {...(props as React.ComponentPropsWithoutRef<typeof Pressable>)}
        />
      )
    }
    return <View ref={ref} className={rowClassName} {...props} />
  }
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(
        'flex-1 min-w-[80px] h-10 px-2 justify-center',
        'border-r border-gray-200 dark:border-gray-600 last:border-r-0',
        className
      )}
      {...props}
    />
  )
)
TableHead.displayName = 'TableHead'

interface TableCellProps extends ViewProps {
  colSpan?: number
}

const TableCell = React.forwardRef<View, TableCellProps>(
  ({ className, colSpan, style, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(
        'min-w-[80px] p-2 justify-center',
        !colSpan && 'flex-1',
        'border-r border-gray-200 dark:border-gray-600 last:border-r-0',
        className
      )}
      style={[colSpan ? { flex: colSpan } : undefined, style]}
      {...props}
    />
  )
)
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('mt-4', className)} {...props} />
  )
)
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
