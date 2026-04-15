import { cn } from '@/lib/utils'
import { SPRING_CONFIGS } from '@/constants/motion'
import { colors } from '@/constants'
import { Check, ChevronRight } from 'lucide-react-native'
import React, { ComponentProps, useEffect, useMemo, useRef } from 'react'
import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

interface TriggerLayout {
  x: number
  y: number
  width: number
  height: number
}

interface DropdownContextType {
  onOpenChange: (open: boolean) => void
  onExitComplete?: () => void
  open: boolean
  triggerLayout: TriggerLayout | null
  setTriggerLayout: (layout: TriggerLayout | null) => void
}

const DropdownContext = React.createContext<DropdownContextType | null>(null)

interface DropdownProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface DropdownTriggerProps extends ComponentProps<typeof TouchableOpacity> {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}

interface DropdownContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'end' | 'center'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  alignOffset?: number
}

interface DropdownLabelProps extends ComponentProps<typeof View> {
  children: React.ReactNode
  className?: string
  inset?: boolean
}

interface DropdownItemProps extends ComponentProps<typeof TouchableOpacity> {
  children: React.ReactNode
  onSelect?: () => void
  className?: string
  disabled?: boolean
  inset?: boolean
}

interface DropdownSeparatorProps extends ComponentProps<typeof View> {
  className?: string
}

interface DropdownGroupProps extends ComponentProps<typeof View> {
  children: React.ReactNode
  className?: string
}

interface DropdownShortcutProps extends ComponentProps<typeof View> {
  children: React.ReactNode
  className?: string
}

interface DropdownSubProps {
  children: React.ReactNode
}

interface DropdownSubTriggerProps extends ComponentProps<typeof TouchableOpacity> {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onPress?: () => void
  isOpen?: boolean
}

interface DropdownSubContentProps extends ComponentProps<typeof View> {
  children: React.ReactNode
  className?: string
  alignOffset?: number
  sideOffset?: number
}

interface DropdownPortalProps {
  children: React.ReactNode
}

interface DropdownCheckboxItemProps extends ComponentProps<typeof TouchableOpacity> {
  children: React.ReactNode
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
}

interface DropdownRadioItemProps extends ComponentProps<typeof TouchableOpacity> {
  children: React.ReactNode
  value: string
  className?: string
  disabled?: boolean
}

interface DropdownRadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

// Type guard to check if component is a specific type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isComponentType(child: React.ReactNode, componentType: React.ComponentType<any>): boolean {
  if (!React.isValidElement(child)) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childType = child.type as React.ComponentType<any>
  return (
    childType === componentType ||
    (childType as { displayName?: string })?.displayName ===
      (componentType as { displayName?: string })?.displayName
  )
}

// Root component - manages state
function Dropdown({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}: DropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [triggerLayout, setTriggerLayout] = React.useState<TriggerLayout | null>(null)
  // isMounted stays true while open OR during exit animation
  const [showContent, setShowContent] = React.useState(false)

  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
  const onOpenChange = controlledOnOpenChange || setUncontrolledOpen

  // open → mount content immediately via effect
  React.useEffect(() => {
    if (open) setShowContent(true)
  }, [open])

  const isMounted = open || showContent

  const handleExitComplete = React.useCallback(() => setShowContent(false), [])

  // Separate trigger and content from children
  const childrenArray = React.Children.toArray(children)
  const trigger = childrenArray.find((child) =>
    isComponentType(child, DropdownTrigger)
  )
  const content = childrenArray.find((child) =>
    isComponentType(child, DropdownContent)
  )

  return (
    <DropdownContext.Provider
      value={{
        onOpenChange,
        onExitComplete: handleExitComplete,
        open,
        triggerLayout,
        setTriggerLayout,
      }}
    >
      {trigger}
      <Modal
        visible={isMounted}
        transparent
        animationType="none"
        onRequestClose={() => onOpenChange(false)}
      >
        {content}
      </Modal>
    </DropdownContext.Provider>
  )
}

// Trigger - wraps the element that opens the dropdown
function DropdownTrigger({
  children,
  asChild = false,
  className,
  ...props
}: DropdownTriggerProps) {
  const context = React.useContext(DropdownContext)
  const triggerRef = useRef<View>(null)
  const contextRef = useRef(context)
  const [shouldMeasure, setShouldMeasure] = React.useState(false)

  // Keep context ref in sync
  React.useEffect(() => {
    contextRef.current = context
  }, [context])

  if (!context && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('DropdownTrigger must be used inside Dropdown component')
  }

  // Measure trigger when shouldMeasure is true
  React.useEffect(() => {
    if (shouldMeasure && triggerRef.current && contextRef.current) {
      requestAnimationFrame(() => {
        if (triggerRef.current && contextRef.current) {
          triggerRef.current.measureInWindow((x, y, width, height) => {
            contextRef.current?.setTriggerLayout({ x, y, width, height })
            contextRef.current?.onOpenChange(true)
            setShouldMeasure(false)
          })
        }
      })
    }
  }, [shouldMeasure])


  const handlePress = () => {
    // Trigger measurement via state
    setShouldMeasure(true)
  }

  const handleLayout = () => {
    // Re-measure when layout changes and dropdown is open
    if (context?.open && triggerRef.current) {
      requestAnimationFrame(() => {
        if (triggerRef.current) {
          triggerRef.current.measureInWindow((x, y, width, height) => {
            contextRef.current?.setTriggerLayout({ x, y, width, height })
          })
        }
      })
    }
  }

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<ComponentProps<typeof TouchableOpacity>>
    return (
      <View 
        ref={triggerRef} 
        collapsable={false}
        onLayout={handleLayout}
      >
        {React.cloneElement(child, {
          ...child.props,
          onPress: (e: unknown) => {
            if (child.props?.onPress) {
              child.props.onPress(e as never)
            }
            handlePress()
          },
          ...props,
        })}
      </View>
    )
  }

  return (
    <View 
      ref={triggerRef} 
      collapsable={false}
      onLayout={handleLayout}
    >
      <TouchableOpacity
        onPress={handlePress}
        className={className}
        {...props}
      >
        {children}
      </TouchableOpacity>
    </View>
  )
}

const SPRING = SPRING_CONFIGS.popover

// Content - the dropdown container
function DropdownContent({
  children,
  className,
  align: _align = 'end',
  side = 'bottom',
  sideOffset = 20,
  alignOffset: _alignOffset = 0,
}: DropdownContentProps) {
  const context = React.useContext(DropdownContext)
  const contentRef = useRef<View>(null)
  const [contentLayout, setContentLayout] = React.useState<{ width: number; height: number } | null>(null)
  const { width: screenWidth } = useWindowDimensions()

  const scale = useSharedValue(0.95)
  const opacity = useSharedValue(0)
  const slideX = useSharedValue(0)
  const slideY = useSharedValue(0)

  const handleContentLayout = (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout
    setContentLayout({ width, height })
  }

  useEffect(() => {
    const slideInitialValues = {
      top: { x: 0, y: -8 },
      bottom: { x: 0, y: 8 },
      left: { x: -8, y: 0 },
      right: { x: 8, y: 0 },
    }
    const initial = slideInitialValues[side]

    if (context?.open) {
      scale.value = 0.95
      opacity.value = 0
      slideX.value = initial.x
      slideY.value = initial.y

      const timeoutId = setTimeout(() => {
        scale.value = withSpring(1, SPRING)
        opacity.value = withSpring(1, SPRING)
        slideX.value = withSpring(0, SPRING)
        slideY.value = withSpring(0, SPRING)
      }, 16)

      return () => clearTimeout(timeoutId)
    }

    // Đóng: dứt khoát nhưng không khựng
    scale.value = withSpring(0.95, SPRING)
    opacity.value = withSpring(0, SPRING)
    slideX.value = withSpring(initial.x, SPRING)
    slideY.value = withSpring(
      initial.y,
      SPRING,
      (finished) => {
        if (finished && context?.onExitComplete) {
          runOnJS(context.onExitComplete)()
        }
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.open, side])

  // Animated style running on UI thread
  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: opacity.value,
      transform: [
        { scale: scale.value },
        { translateX: slideX.value },
        { translateY: slideY.value },
      ],
    }
  })

  // Memoize position — chỉ tính lại khi trigger layout, content layout, side, hoặc screen width thay đổi
  const positionStyle = useMemo(() => {
    if (!context?.triggerLayout) return {}

    const { y, height: triggerHeight } = context.triggerLayout
    const contentHeight = contentLayout?.height ?? 100
    const horizontalPadding = 20

    let top = 0
    if (side === 'bottom') {
      top = y + triggerHeight + 16 + sideOffset
    } else if (side === 'top') {
      top = y - contentHeight - 16 - sideOffset
    } else {
      top = y + (triggerHeight - contentHeight) / 2
    }

    return {
      top,
      left: horizontalPadding,
      right: horizontalPadding,
      width: screenWidth - horizontalPadding * 2,
    }
  }, [context?.triggerLayout, contentLayout, side, sideOffset, screenWidth])

  return (
    <Pressable
      className="flex-1"
      onPress={() => context?.onOpenChange(false)}
    >
      <Pressable onPress={(e) => e.stopPropagation()}>
        <Animated.View
          ref={contentRef}
          onLayout={handleContentLayout}
          className={cn(
            'absolute z-50 overflow-hidden rounded-md border p-1',
            'bg-white dark:bg-gray-900',
            'border-gray-200 dark:border-gray-700',
            'shadow-md',
            className
          )}
          style={[
            positionStyle,
            animatedStyle,
          ]}
        >
          {children}
        </Animated.View>
      </Pressable>
    </Pressable>
  )
}

// Label - non-interactive text label
function DropdownLabel({
  children,
  className,
  inset = false,
  ...props
}: DropdownLabelProps) {
  return (
    <View
      className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
      {...props}
    >
      <Text className="text-gray-900 dark:text-gray-50 font-semibold text-sm">
        {children}
      </Text>
    </View>
  )
}

// Item - interactive menu item
function DropdownItem({
  children,
  onSelect,
  className,
  disabled = false,
  inset = false,
  ...props
}: DropdownItemProps) {
  const context = React.useContext(DropdownContext)

  const handlePress = () => {
    if (!disabled) {
      onSelect?.()
      // Small delay to allow animation
      setTimeout(() => {
        context?.onOpenChange(false)
      }, 100)
    }
  }

  return (
    <TouchableOpacity
      className={cn(
        'relative flex-row items-center gap-2 rounded-sm px-2 py-1.5',
        'text-sm outline-none',
        inset && 'pl-8',
        'active:bg-gray-100 dark:active:bg-gray-800',
        disabled && 'opacity-50',
        disabled && 'pointer-events-none',
        className
      )}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      {children}
    </TouchableOpacity>
  )
}

// Separator - visual divider
function DropdownSeparator({ className, ...props }: DropdownSeparatorProps) {
  return (
    <View
      className={cn(
        '-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-700',
        className
      )}
      {...props}
    />
  )
}

// Group - groups related items
function DropdownGroup({ children, className, ...props }: DropdownGroupProps) {
  return (
    <View className={cn('py-1', className)} {...props}>
      {children}
    </View>
  )
}

// Shortcut - displays keyboard shortcut (right-aligned text)
function DropdownShortcut({ children, className, ...props }: DropdownShortcutProps) {
  return (
    <View className={cn('ml-auto', className)} {...props}>
      <Text className="text-gray-500 dark:text-gray-400 text-xs tracking-widest opacity-60">
        {children}
      </Text>
    </View>
  )
}

// Sub - nested submenu container (simplified for React Native)
function DropdownSub({ children }: DropdownSubProps) {
  const [open, setOpen] = React.useState(false)

  // Extract SubTrigger and SubContent
  const childrenArray = React.Children.toArray(children)
  const trigger = childrenArray.find((child) =>
    isComponentType(child, DropdownSubTrigger)
  )
  const content = childrenArray.find((child) =>
    isComponentType(child, DropdownSubContent)
  )

  return (
    <View className="relative">
      {React.isValidElement(trigger) &&
        React.cloneElement(
          trigger as React.ReactElement<DropdownSubTriggerProps>,
          {
            onPress: () => setOpen(!open),
            isOpen: open,
          } as Partial<DropdownSubTriggerProps>
        )}
      {open && content && (
        <View className="absolute left-full top-0 ml-1 z-50">{content}</View>
      )}
    </View>
  )
}

// SubTrigger - trigger for submenu
function DropdownSubTrigger({
  children,
  className,
  disabled = false,
  onPress,
  isOpen,
  inset = false,
  ...props
}: DropdownSubTriggerProps & { inset?: boolean }) {
  const isDark = useColorScheme() === 'dark'
  
  return (
    <TouchableOpacity
      className={cn(
        'flex-row items-center gap-2 rounded-sm px-2 py-1.5',
        'text-sm outline-none',
        inset && 'pl-8',
        'active:bg-gray-100 dark:active:bg-gray-800',
        disabled && 'opacity-50',
        disabled && 'pointer-events-none',
        isOpen && 'bg-gray-100 dark:bg-gray-800',
        className
      )}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
      {...props}
    >
      {children}
      <View className="ml-auto">
        <ChevronRight size={16} color={isDark ? colors.mutedForeground.dark : colors.mutedForeground.light} />
      </View>
    </TouchableOpacity>
  )
}

// SubContent - content for submenu
function DropdownSubContent({
  children,
  className,
  alignOffset = 0,
  sideOffset = 0,
  ...props
}: DropdownSubContentProps) {
  return (
    <View
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border p-1',
        'bg-white dark:bg-gray-900',
        'border-gray-200 dark:border-gray-700',
        'shadow-lg',
        className
      )}
      style={{
        marginLeft: alignOffset,
        marginTop: sideOffset,
      }}
      {...props}
    >
      {children}
    </View>
  )
}

// CheckboxItem - item with checkbox indicator
function DropdownCheckboxItem({
  children,
  checked = false,
  onCheckedChange,
  className,
  disabled = false,
  ...props
}: DropdownCheckboxItemProps) {
  const context = React.useContext(DropdownContext)
  const isDark = useColorScheme() === 'dark'

  const handlePress = () => {
    if (!disabled) {
      onCheckedChange?.(!checked)
      // Small delay to allow animation
      setTimeout(() => {
        context?.onOpenChange(false)
      }, 100)
    }
  }

  return (
    <TouchableOpacity
      className={cn(
        'relative flex-row items-center rounded-sm py-1.5 pl-8 pr-2',
        'text-sm outline-none',
        'active:bg-gray-100 dark:active:bg-gray-800',
        disabled && 'opacity-50',
        disabled && 'pointer-events-none',
        className
      )}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      <View className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {checked && (
          <Check size={16} color={isDark ? '#60a5fa' : '#3b82f6'} />
        )}
      </View>
      <Text className="text-sm text-gray-900 dark:text-gray-50">
        {children}
      </Text>
    </TouchableOpacity>
  )
}

// RadioGroup context
interface RadioGroupContextType {
  value?: string
  onValueChange?: (value: string) => void
}

const RadioGroupContext = React.createContext<RadioGroupContextType | null>(null)

// RadioGroup - container for radio items
function DropdownRadioGroup({
  value,
  onValueChange,
  children,
}: DropdownRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      {children}
    </RadioGroupContext.Provider>
  )
}

// RadioItem - item with radio indicator
function DropdownRadioItem({
  children,
  value,
  className,
  disabled = false,
  ...props
}: DropdownRadioItemProps) {
  const context = React.useContext(DropdownContext)
  const radioContext = React.useContext(RadioGroupContext)
  const isDark = useColorScheme() === 'dark'

  const isSelected = radioContext?.value === value

  const handlePress = () => {
    if (!disabled && radioContext?.onValueChange) {
      radioContext.onValueChange(value)
      // Small delay to allow animation
      setTimeout(() => {
        context?.onOpenChange(false)
      }, 100)
    }
  }

  return (
    <TouchableOpacity
      className={cn(
        'relative flex-row items-center rounded-sm py-1.5 pl-8 pr-2',
        'text-sm outline-none',
        'active:bg-gray-100 dark:active:bg-gray-800',
        disabled && 'opacity-50',
        disabled && 'pointer-events-none',
        className
      )}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      <View className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && (
          <View 
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: isDark ? '#60a5fa' : '#3b82f6' }}
          />
        )}
      </View>
      <Text className="text-sm text-gray-900 dark:text-gray-50">
        {children}
      </Text>
    </TouchableOpacity>
  )
}

// Portal - for future use (currently just renders children)
function DropdownPortal({ children }: DropdownPortalProps) {
  return <>{children}</>
}

// Set display names for component identification
DropdownTrigger.displayName = 'DropdownTrigger'
DropdownContent.displayName = 'DropdownContent'
DropdownSubTrigger.displayName = 'DropdownSubTrigger'
DropdownSubContent.displayName = 'DropdownSubContent'
DropdownCheckboxItem.displayName = 'DropdownCheckboxItem'
DropdownRadioGroup.displayName = 'DropdownRadioGroup'
DropdownRadioItem.displayName = 'DropdownRadioItem'

// Compose component (shadcn pattern)
Dropdown.Trigger = DropdownTrigger
Dropdown.Content = DropdownContent
Dropdown.Label = DropdownLabel
Dropdown.Item = DropdownItem
Dropdown.CheckboxItem = DropdownCheckboxItem
Dropdown.RadioGroup = DropdownRadioGroup
Dropdown.RadioItem = DropdownRadioItem
Dropdown.Separator = DropdownSeparator
Dropdown.Group = DropdownGroup
Dropdown.Shortcut = DropdownShortcut
Dropdown.Sub = DropdownSub
Dropdown.SubTrigger = DropdownSubTrigger
Dropdown.SubContent = DropdownSubContent
Dropdown.Portal = DropdownPortal

// Export with shadcn naming convention
export {
  Dropdown,
  Dropdown as DropdownMenu, DropdownCheckboxItem as DropdownMenuCheckboxItem, DropdownContent as DropdownMenuContent,
  DropdownGroup as DropdownMenuGroup,
  DropdownItem as DropdownMenuItem, DropdownLabel as DropdownMenuLabel,
  DropdownPortal as DropdownMenuPortal, DropdownRadioGroup as DropdownMenuRadioGroup,
  DropdownRadioItem as DropdownMenuRadioItem, DropdownSeparator as DropdownMenuSeparator,
  DropdownShortcut as DropdownMenuShortcut,
  DropdownSub as DropdownMenuSub,
  DropdownSubContent as DropdownMenuSubContent,
  DropdownSubTrigger as DropdownMenuSubTrigger,
  DropdownTrigger as DropdownMenuTrigger
}

