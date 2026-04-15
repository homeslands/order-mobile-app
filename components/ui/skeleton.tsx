import * as React from 'react'
import { View, type ViewProps } from 'react-native'

import { cn } from '@/utils/cn'

export interface SkeletonProps extends ViewProps {
  className?: string
}

/**
 * Simple skeleton placeholder component.
 * Use Tailwind classes via `className` to control width/height.
 *
 * Example:
 * <Skeleton className="h-4 w-32 mb-2" />
 */
export function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <View
      className={cn(
        'bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden',
        className,
      )}
      style={style}
      {...props}
    />
  )
}


