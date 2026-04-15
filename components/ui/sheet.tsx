import { cn } from '@/lib/utils'
import React, { useMemo } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { SPRING_CONFIGS, colors } from '@/constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface SheetContentProps {
  children: React.ReactNode
  className?: string
  onClose?: () => void
  open?: boolean
  direction?: 'left' | 'right' | 'bottom'
}

interface SheetHeaderProps {
  children: React.ReactNode
  className?: string
}

interface SheetTitleProps {
  children: React.ReactNode
  className?: string
}

interface SheetDescriptionProps {
  children: React.ReactNode
  className?: string
}

interface SheetFooterProps {
  children: React.ReactNode
  className?: string
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  // Local state to delay Modal unmount until close animation completes
  const [modalVisible, setModalVisible] = React.useState(open)

  // Find SheetContent child and pass props
  const childrenArray = React.Children.toArray(children)
  const sheetContentChild = childrenArray.find(
    (child) => React.isValidElement(child) && child.type === SheetContent
  )
  const otherChildren = childrenArray.filter(
    (child) => !React.isValidElement(child) || child.type !== SheetContent
  )

  // Handle Modal visibility with animation delay
  React.useEffect(() => {
    if (open) {
      setModalVisible(true)
    } else {
      const timeoutId = setTimeout(() => {
        setModalVisible(false)
      }, 350) // Match animation duration
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  if (!sheetContentChild || !React.isValidElement(sheetContentChild)) {
    return <>{children}</>
  }

  return (
    <>
      {/* Render trigger/other children outside Modal */}
      {otherChildren}
      {/* Render SheetContent inside Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={() => onOpenChange(false)}
      >
        {React.cloneElement(sheetContentChild, {
          open,
          onClose: () => onOpenChange(false),
        } as Parameters<typeof React.cloneElement>[1])}
      </Modal>
    </>
  )
}

function SheetContent({ children, className, onClose, open, direction = 'right' }: SheetContentProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  
  // Animation values
  const slideValue = useSharedValue(1)
  const fadeValue = useSharedValue(0)
  const isInitialMount = React.useRef(true)

  // Handle animation
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (open) {
        const timeoutId = setTimeout(() => {
          slideValue.value = withSpring(0, SPRING_CONFIGS.modal)
          fadeValue.value = withSpring(1, SPRING_CONFIGS.modal)
        }, 16)
        return () => clearTimeout(timeoutId)
      }
      return
    }

    if (open) {
      slideValue.value = withSpring(0, SPRING_CONFIGS.modal)
      fadeValue.value = withSpring(1, SPRING_CONFIGS.modal)
    } else {
      slideValue.value = withSpring(1, SPRING_CONFIGS.modal)
      fadeValue.value = withSpring(0, SPRING_CONFIGS.modal)
    }
  }, [open, slideValue, fadeValue])

  // Calculate slide range
  const slideRange = useMemo(() => {
    switch (direction) {
      case 'left':
        return [-screenWidth, 0]
      case 'right':
        return [screenWidth, 0]
      case 'bottom':
        return [screenHeight, 0]
      default:
        return [screenWidth, 0]
    }
  }, [direction, screenWidth, screenHeight])

  // Get position style with safe area insets
  const positionStyle = useMemo(() => {
    switch (direction) {
      case 'left':
        return { 
          left: 0, 
          top: insets.top, 
          bottom: insets.bottom 
        }
      case 'right':
        return { 
          right: 0, 
          top: insets.top, 
          bottom: insets.bottom 
        }
      case 'bottom':
        return { 
          bottom: insets.bottom, 
          left: 0, 
          right: 0 
        }
      default:
        return { 
          right: 0, 
          top: insets.top, 
          bottom: insets.bottom 
        }
    }
  }, [direction, insets])

  // Get size style with safe area consideration
  const sizeStyle = useMemo(() => {
    switch (direction) {
      case 'left':
      case 'right':
        return { 
          width: Math.min(screenWidth * 0.85, 400),
          height: screenHeight - insets.top - insets.bottom
        }
      case 'bottom':
        return { 
          maxHeight: screenHeight * 0.9 - insets.top 
        }
      default:
        return { 
          width: Math.min(screenWidth * 0.85, 400),
          height: screenHeight - insets.top - insets.bottom
        }
    }
  }, [direction, screenWidth, screenHeight, insets])

  // Animated styles
  const sheetAnimatedStyle = useAnimatedStyle(() => {
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

  const handleBackdropPress = () => {
    if (onClose) {
      onClose()
    }
  }

  return (
    <View className="flex-1">
      {/* Backdrop */}
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
        <Pressable className="flex-1" onPress={handleBackdropPress} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            backgroundColor: isDark ? colors.gray[800] : colors.white.light,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: direction === 'bottom' ? -2 : 0,
            },
            shadowRadius: 10,
            elevation: 10,
            ...positionStyle,
            ...sizeStyle,
          },
          direction === 'bottom' && {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
          (direction === 'left' || direction === 'right') && {
            borderTopLeftRadius: direction === 'right' ? 0 : 24,
            borderTopRightRadius: direction === 'left' ? 0 : 24,
            borderBottomLeftRadius: direction === 'right' ? 0 : 24,
            borderBottomRightRadius: direction === 'left' ? 0 : 24,
          },
          sheetAnimatedStyle,
        ]}
      >
        {/* Handle indicator for bottom sheet */}
        {direction === 'bottom' && (
          <View className="items-center py-3">
            <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </View>
        )}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className={cn('', className)}>{children}</View>
        </ScrollView>
      </Animated.View>
    </View>
  )
}

function SheetHeader({ children, className }: SheetHeaderProps) {
  return <View className={cn('mb-4', className)}>{children}</View>
}

function SheetTitle({ children, className }: SheetTitleProps) {
  return (
    <Text
      className={cn(
        'text-lg font-semibold text-gray-900 dark:text-white',
        className
      )}
    >
      {children}
    </Text>
  )
}

function SheetDescription({ children, className }: SheetDescriptionProps) {
  return (
    <Text
      className={cn('text-sm text-gray-600 dark:text-gray-400', className)}
    >
      {children}
    </Text>
  )
}

function SheetFooter({ children, className }: SheetFooterProps) {
  return (
    <View className={cn('flex-row gap-3 mt-4', className)}>{children}</View>
  )
}

Sheet.Content = SheetContent
Sheet.Header = SheetHeader
Sheet.Title = SheetTitle
Sheet.Description = SheetDescription
Sheet.Footer = SheetFooter

export { Sheet }
