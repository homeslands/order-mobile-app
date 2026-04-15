import { cn } from '@/lib/utils'
import { SPRING_CONFIGS } from '@/constants/motion'
import { colors } from '@/constants'
import { X } from 'lucide-react-native'
import React, { ReactNode, useEffect } from 'react'
import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

interface BaseProps {
  children: ReactNode
  className?: string
}

interface DialogContentProps extends BaseProps {
  onClose?: () => void
  onExitComplete?: () => void
  open?: boolean
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Giữ Modal hiển thị trong khi chạy exit animation để tránh giật
  const [isMounted, setIsMounted] = React.useState(open)

  // Khi external open = true → đảm bảo Modal được mount
  useEffect(() => {
    if (open) {
      // Đẩy setState sang tick tiếp theo để tránh setState sync trong effect
      const id = setTimeout(() => setIsMounted(true), 0)
      return () => clearTimeout(id)
    }
  }, [open])

  const handleRequestClose = () => {
    onOpenChange(false)
  }

  const handleExitComplete = () => {
    setIsMounted(false)
  }

  // Truyền open + onClose + onExitComplete xuống Content để điều khiển animation
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === DialogContent) {
      return React.cloneElement(child, {
        onClose: handleRequestClose,
        onExitComplete: handleExitComplete,
        open,
      } as Parameters<typeof React.cloneElement>[1])
    }
    return child
  })

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
    >
      {childrenWithProps}
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

const SPRING = SPRING_CONFIGS.modal

function DialogContent({ children, className, onClose, onExitComplete, open = true }: DialogContentProps) {
  // Shared values for UI thread animations
  // Apple style: scale 0.95 -> 1, opacity 0 -> 1 đồng thời
  const scale = useSharedValue(0.95)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-8)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (open) {
      // Reset về trạng thái bắt đầu trước khi animate in
      scale.value = 0.95
      opacity.value = 0
      translateY.value = -8
      backdropOpacity.value = 0

      // withDelay(16) thay setTimeout — frame delay trên UI thread, tránh đánh thức JS
      backdropOpacity.value = withDelay(16, withSpring(1, SPRING))
      opacity.value = withDelay(16, withSpring(1, SPRING))
      scale.value = withDelay(16, withSpring(1, SPRING))
      translateY.value = withDelay(16, withSpring(0, SPRING))
      return
    }

    // Đóng: dứt khoát nhưng không khựng — dùng spring
    backdropOpacity.value = withSpring(0, SPRING)
    opacity.value = withSpring(0, SPRING)
    scale.value = withSpring(0.95, SPRING)
    translateY.value = withSpring(
      -8,
      SPRING,
      (finished) => {
        if (finished && onExitComplete) {
          runOnJS(onExitComplete)()
        }
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = () => {
    // Đóng khi bấm backdrop: set open=false qua onClose (Dialog root sẽ xử lý unmount)
    if (onClose) {
      onClose()
    }
  }

  // Animated styles running on UI thread
  const backdropStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: backdropOpacity.value,
    }
  })

  const contentStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: opacity.value,
      transform: [
        { scale: scale.value },
        { translateY: translateY.value },
      ],
    }
  })

  return (
    <View className="flex-1 items-center justify-center">
      {/* Backdrop - Fade animation (shadcn: bg-black/80) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)', // bg-black/80
          },
          backdropStyle,
        ]}
      >
        <Pressable className="flex-1" onPress={handleClose} />
      </Animated.View>

      {/* Dialog Content - Scale + Fade + Slide animation (shadcn style) */}
      {/* Width full với padding horizontal, căn giữa */}
      <Animated.View
        style={[
          {
            width: '100%',
            paddingHorizontal: 0,
            alignItems: 'center',
          },
          contentStyle,
        ]}
      >
        <View
          className={cn(
            'w-full rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800',
            className
          )}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Close                                    */
/* -------------------------------------------------------------------------- */

function DialogClose({ onPress }: { onPress: () => void }) {
  const isDark = useColorScheme() === 'dark'

  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute right-4 top-4 opacity-70 active:opacity-100"
    >
      <X size={22} color={isDark ? colors.white.light : colors.gray[900]} />
    </TouchableOpacity>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Sub components                                */
/* -------------------------------------------------------------------------- */

function DialogHeader({ children, className }: BaseProps) {
  return (
    <View className={cn('mb-4 gap-1.5', className)}>{children}</View>
  )
}

function DialogTitle({ children, className }: BaseProps) {
  // Check if children is an array or contains multiple elements (for icon + text layout)
  const childrenArray = React.Children.toArray(children)
  const hasMultipleChildren = childrenArray.length > 1
  
  if (hasMultipleChildren) {
    // Extract text-related classes from className (like text-destructive, text-lg, etc.)
    // Layout classes (flex, items-center, gap-2) stay on View
    // Text classes go to Text component
    const textClasses = className?.split(' ').filter(cls => 
      cls.startsWith('text-') || cls.startsWith('font-')
    ).join(' ') || ''
    
    return (
      <View className={cn('flex-row items-center gap-2', className)}>
        {React.Children.map(children, (child) => {
          // If child is a string, wrap it in Text component
          if (typeof child === 'string') {
            return (
              <Text
                className={cn(
                  'text-lg font-semibold text-gray-900 dark:text-white',
                  textClasses
                )}
              >
                {child}
              </Text>
            )
          }
          // Otherwise, return as is (for icons, etc.)
          return child
        })}
      </View>
    )
  }
  
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

function DialogDescription({ children, className }: BaseProps) {
  return (
    <Text
      className={cn(
        'text-sm text-gray-600 dark:text-gray-400',
        className
      )}
    >
      {children}
    </Text>
  )
}

function DialogFooter({ children, className }: BaseProps) {
  return (
    <View
      className={cn('mt-6 flex-row justify-end gap-3', className)}
    >
      {children}
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Trigger                                   */
/* -------------------------------------------------------------------------- */
/**
 * Chỉ để giữ API giống shadcn
 * Dialog RN là controlled → Trigger KHÔNG tự mở dialog
 */
function DialogTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/* -------------------------------------------------------------------------- */
/*                                Attach API                                  */
/* -------------------------------------------------------------------------- */

Dialog.Content = DialogContent
Dialog.Header = DialogHeader
Dialog.Title = DialogTitle
Dialog.Description = DialogDescription
Dialog.Footer = DialogFooter
Dialog.Close = DialogClose
Dialog.Trigger = DialogTrigger

export { Dialog }
