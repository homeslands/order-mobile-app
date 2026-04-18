import { cn } from '@/utils/cn'
import React, { ReactNode, useEffect } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { SPRING_CONFIGS } from '@/constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface DrawerContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DrawerContext = React.createContext<DrawerContextType | null>(null)

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  direction?: 'left' | 'right' | 'top' | 'bottom'
}

interface DrawerTriggerProps {
  children: ReactNode
  asChild?: boolean
  className?: string
}

interface DrawerCloseProps {
  children: ReactNode
  className?: string
  asChild?: boolean
}

interface DrawerContentProps {
  children: ReactNode
  className?: string
  height?: number | string
}

interface DrawerHeaderProps {
  children: ReactNode
  className?: string
}

interface DrawerFooterProps {
  children: ReactNode
  className?: string
}

interface DrawerTitleProps {
  children: ReactNode
  className?: string
}

interface DrawerDescriptionProps {
  children: ReactNode
  className?: string
}

// Root component - manages state
function Drawer({
  open,
  onOpenChange,
  children,
  direction = 'left',
}: DrawerProps) {
  // Local state to delay Modal unmount until close animation completes
  const [modalVisible, setModalVisible] = React.useState(open)

  // Separate trigger and content from children
  const childrenArray = React.Children.toArray(children)
  const trigger = childrenArray.find((child) => {
    if (!React.isValidElement(child)) return false
    const childType = child.type as { displayName?: string }
    return childType?.displayName === 'DrawerTrigger'
  })
  const content = childrenArray.find((child) => {
    if (!React.isValidElement(child)) return false
    const childType = child.type as { displayName?: string }
    return childType?.displayName === 'DrawerContent'
  })

  // Handle Modal visibility with animation delay
  React.useEffect(() => {
    if (open) {
      // Show Modal immediately when opening
      setModalVisible(true)
    } else {
      // Delay hiding Modal to allow close animation to complete
      const timeoutId = setTimeout(() => {
        setModalVisible(false)
      }, 350) // Match animation duration
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  return (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      {/* Render trigger outside Modal */}
      {trigger}
      {/* Render content inside Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={() => onOpenChange(false)}
      >
        {React.isValidElement(content) &&
          React.cloneElement(
            content as React.ReactElement<
              DrawerContentProps & {
                direction?: 'left' | 'right' | 'top' | 'bottom'
              }
            >,
            {
              direction,
            },
          )}
      </Modal>
    </DrawerContext.Provider>
  )
}

// Trigger - wraps the element that opens the drawer
function DrawerTrigger({
  children,
  asChild = false,
  className,
}: DrawerTriggerProps) {
  const context = React.useContext(DrawerContext)

  if (!context) {
    // eslint-disable-next-line no-console
    console.warn('DrawerTrigger must be used inside Drawer component')
  }

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onPress?: () => void }>
    return React.cloneElement(child, {
      ...child.props,
      onPress: () => {
        child.props?.onPress?.()
        context?.onOpenChange(true)
      },
    })
  }

  return (
    <TouchableOpacity
      onPress={() => context?.onOpenChange(true)}
      className={className}
    >
      {children}
    </TouchableOpacity>
  )
}

// Content - the drawer container
function DrawerContent({
  children,
  className,
  direction = 'left',
  height,
}: DrawerContentProps & { direction?: 'left' | 'right' | 'top' | 'bottom' }) {
  const context = React.useContext(DrawerContext)
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

  // Always start from closed state (1) to ensure animation plays
  const slideValue = useSharedValue(1)
  const fadeValue = useSharedValue(0)

  // Track if this is the initial mount
  const isInitialMount = React.useRef(true)

  useEffect(() => {
    // On initial mount, if drawer is open, animate in
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (context?.open) {
        // Small delay to ensure component is fully mounted and rendered
        const timeoutId = setTimeout(() => {
          slideValue.value = withSpring(0, SPRING_CONFIGS.modal)
          fadeValue.value = withSpring(1, SPRING_CONFIGS.modal)
        }, 16) // One frame delay
        return () => clearTimeout(timeoutId)
      }
      return
    }

    // Handle state changes after initial mount
    if (context?.open) {
      slideValue.value = withSpring(0, SPRING_CONFIGS.modal)
      fadeValue.value = withSpring(1, SPRING_CONFIGS.modal)
    } else {
      slideValue.value = withSpring(1, SPRING_CONFIGS.modal)
      fadeValue.value = withSpring(0, SPRING_CONFIGS.modal)
    }
  }, [context?.open, slideValue, fadeValue])

  const getPositionStyle = (): {
    left?: number
    right?: number
    top?: number
    bottom?: number
  } => {
    switch (direction) {
      case 'left':
        return { left: 0, top: insets.top, bottom: insets.bottom }
      case 'right':
        return { right: 0, top: insets.top, bottom: insets.bottom }
      case 'top':
        return { top: insets.top, left: 0, right: 0 }
      case 'bottom':
        return { bottom: insets.bottom, left: 0, right: 0 }
    }
  }

  const getSizeStyle = (): { width?: number; height?: number } => {
    switch (direction) {
      case 'left':
      case 'right':
        if (height) {
          // Calculate height from percentage string or use number directly
          const calculatedHeight =
            typeof height === 'string' && height.includes('%')
              ? (parseFloat(height) / 100) *
                (screenHeight - insets.top - insets.bottom)
              : typeof height === 'number'
                ? height
                : screenHeight - insets.top - insets.bottom
          return {
            width: Math.min(screenWidth * 0.8, 340),
            height: calculatedHeight,
          }
        }
        return { width: Math.min(screenWidth * 0.8, 340) }
      case 'top':
      case 'bottom':
        if (height) {
          const calculatedHeight =
            typeof height === 'string' && height.includes('%')
              ? (parseFloat(height) / 100) *
                (screenHeight - insets.top - insets.bottom)
              : typeof height === 'number'
                ? height
                : screenHeight - insets.top - insets.bottom
          return { height: calculatedHeight }
        }
        // For bottom drawer, use auto height if className doesn't specify max-h
        return {}
    }
  }

  // Calculate slide range values outside worklet
  const slideRange = (() => {
    switch (direction) {
      case 'left':
        return [-screenWidth, 0]
      case 'right':
        return [screenWidth, 0]
      case 'top':
        return [-screenHeight, 0]
      case 'bottom':
        return [screenHeight, 0]
      default:
        return [-screenWidth, 0]
    }
  })()

  const drawerAnimatedStyle = useAnimatedStyle(() => {
    'worklet'
    const [start, end] = slideRange
    const progress = slideValue.value

    if (direction === 'left' || direction === 'right') {
      return {
        transform: [
          {
            translateX: start + (end - start) * (1 - progress),
          },
        ],
      }
    } else {
      return {
        transform: [
          {
            translateY: start + (end - start) * (1 - progress),
          },
        ],
      }
    }
  })

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeValue.value,
  }))

  const handleClose = () => {
    context?.onOpenChange(false)
  }

  return (
    <View className="flex-1">
      {/* Overlay - Fade animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
          backdropAnimatedStyle,
        ]}
      >
        <Pressable className="flex-1" onPress={handleClose} />
      </Animated.View>

      {/* Drawer - Slide animation */}
      <Animated.View
        className={cn(
          'absolute bg-white shadow-xl dark:bg-gray-800',
          direction === 'left' && 'rounded-r-3xl',
          direction === 'right' && 'rounded-l-3xl',
          direction === 'top' && 'rounded-b-3xl',
          direction === 'bottom' && 'rounded-t-3xl',
          className,
        )}
        style={[
          getPositionStyle(),
          getSizeStyle(),
          drawerAnimatedStyle,
          {
            shadowColor: '#000',
            shadowOffset: {
              width: direction === 'left' ? 2 : direction === 'right' ? -2 : 0,
              height: direction === 'top' ? 2 : direction === 'bottom' ? -2 : 0,
            },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  )
}

// Close button
function DrawerClose({
  children,
  className,
  asChild = false,
}: DrawerCloseProps) {
  const context = React.useContext(DrawerContext)

  if (!context) {
    // eslint-disable-next-line no-console
    console.warn('DrawerClose must be used inside Drawer component')
  }

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onPress?: () => void }>
    return React.cloneElement(child, {
      ...child.props,
      onPress: () => {
        child.props?.onPress?.()
        context?.onOpenChange(false)
      },
    })
  }

  return (
    <TouchableOpacity
      onPress={() => context?.onOpenChange(false)}
      className={className}
    >
      {children}
    </TouchableOpacity>
  )
}

// Header - container for title and description
function DrawerHeader({ children, className }: DrawerHeaderProps) {
  return (
    <View className={cn('flex flex-col gap-1.5 p-6', className)}>
      {children}
    </View>
  )
}

// Footer - container for action buttons
function DrawerFooter({ children, className }: DrawerFooterProps) {
  return (
    <View className={cn('flex flex-col gap-2 p-6', className)}>{children}</View>
  )
}

// Title - drawer title
function DrawerTitle({ children, className }: DrawerTitleProps) {
  return (
    <Text
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-50',
        className,
      )}
    >
      {children}
    </Text>
  )
}

// Description - drawer description
function DrawerDescription({ children, className }: DrawerDescriptionProps) {
  return (
    <Text className={cn('text-sm text-gray-600 dark:text-gray-400', className)}>
      {children}
    </Text>
  )
}

// Set display names for component identification
DrawerTrigger.displayName = 'DrawerTrigger'
DrawerContent.displayName = 'DrawerContent'
DrawerClose.displayName = 'DrawerClose'

// Compose component (shadcn pattern)
Drawer.Trigger = DrawerTrigger
Drawer.Close = DrawerClose
Drawer.Content = DrawerContent
Drawer.Header = DrawerHeader
Drawer.Footer = DrawerFooter
Drawer.Title = DrawerTitle
Drawer.Description = DrawerDescription

export { Drawer }
