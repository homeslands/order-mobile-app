import { cn } from '@/lib/utils'
import React from 'react'
import { ScrollView, View } from 'react-native'

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
  orientation?: 'vertical' | 'horizontal' | 'both'
  type?: 'auto' | 'always' | 'scroll' | 'hover'
}

interface ScrollAreaViewportProps {
  children: React.ReactNode
  className?: string
  contentContainerClassName?: string
}

interface ScrollAreaScrollbarProps {
  children: React.ReactNode
  className?: string
  orientation?: 'vertical' | 'horizontal'
}

interface ScrollAreaThumbProps {
  className?: string
}

interface ScrollAreaCornerProps {
  className?: string
}

// Root component - wrapper for scroll area
function ScrollArea({
  children,
  className,
  orientation: _orientation = 'vertical',
  type: _type = 'auto',
}: ScrollAreaProps) {
  // Separate viewport and scrollbar from children
  const childrenArray = React.Children.toArray(children)
  const viewport = childrenArray.find(
    (child) => {
      if (!React.isValidElement(child)) return false
      // Check by function reference directly (type-safe)
      return child.type === ScrollAreaViewport
    }
  )
  const scrollbar = childrenArray.find(
    (child) => {
      if (!React.isValidElement(child)) return false
      // Check by function reference directly (type-safe)
      return child.type === ScrollAreaScrollbar
    }
  )

  return (
    <View className={cn('relative overflow-hidden', className)}>
      {viewport || children}
      {/* Scrollbar is handled by ScrollView's native scrollbar in React Native */}
      {scrollbar}
    </View>
  )
}

// Viewport - the scrollable content area
function ScrollAreaViewport({
  children,
  className,
  contentContainerClassName,
}: ScrollAreaViewportProps) {
  return (
    <ScrollView
      className={cn('flex-1', className)}
      showsVerticalScrollIndicator={true}
      showsHorizontalScrollIndicator={false}
      bounces={true}
      alwaysBounceVertical={false}
      scrollEventThrottle={16}
    >
      <View className={cn('min-h-full', contentContainerClassName)}>
        {children}
      </View>
    </ScrollView>
  )
}

// Scrollbar - custom scrollbar (in React Native, this is handled natively)
// We keep this for API compatibility but it doesn't render anything visible
function ScrollAreaScrollbar({
  children,
  className,
  orientation: _orientation = 'vertical',
}: ScrollAreaScrollbarProps) {
  // In React Native, scrollbars are native and handled by ScrollView
  // This component exists for API compatibility with shadcn UI
  return <View className={cn('hidden', className)}>{children}</View>
}

// Thumb - scrollbar thumb (not applicable in React Native)
function ScrollAreaThumb({ className: _className }: ScrollAreaThumbProps) {
  // In React Native, scrollbar thumb is native and cannot be customized
  // This component exists for API compatibility
  return null
}

// Corner - scrollbar corner (not applicable in React Native)
function ScrollAreaCorner({ className: _className }: ScrollAreaCornerProps) {
  // In React Native, scrollbar corners are native and cannot be customized
  // This component exists for API compatibility
  return null
}

// Set display names for component identification (for React DevTools)
ScrollAreaViewport.displayName = 'ScrollAreaViewport'
ScrollAreaScrollbar.displayName = 'ScrollAreaScrollbar'
ScrollAreaThumb.displayName = 'ScrollAreaThumb'
ScrollAreaCorner.displayName = 'ScrollAreaCorner'

// Compose component (shadcn pattern)
ScrollArea.Root = ScrollArea
ScrollArea.Viewport = ScrollAreaViewport
ScrollArea.Scrollbar = ScrollAreaScrollbar
ScrollArea.Thumb = ScrollAreaThumb
ScrollArea.Corner = ScrollAreaCorner

export { ScrollArea }

