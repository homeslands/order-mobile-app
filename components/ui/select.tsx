import { cn } from '@/lib/utils'
import { Check, ChevronDown } from 'lucide-react-native'
import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { SPRING_CONFIGS, colors } from '@/constants'

/* ------------------------------------------------------------------ */
/* Context */
/* ------------------------------------------------------------------ */

interface SelectContextType {
  value?: string
  setValue: (v: string) => void
  open: boolean
  setOpen: (o: boolean) => void
}

const SelectContext = React.createContext<SelectContextType | null>(null)

/* ------------------------------------------------------------------ */
/* Root */
/* ------------------------------------------------------------------ */

function Select({
  value,
  defaultValue,
  onValueChange,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)

  const currentValue = value ?? internalValue

  const setValue = (v: string) => {
    if (value === undefined) setInternalValue(v)
    onValueChange?.(v)
  }

  return (
    <SelectContext.Provider
      value={{ value: currentValue, setValue, open, setOpen }}
    >
      {children}
    </SelectContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Trigger */
/* ------------------------------------------------------------------ */

function SelectTrigger({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(SelectContext)
  const isDark = useColorScheme() === 'dark'

  if (!ctx) return null

  return (
    <Pressable
      onPress={() => ctx.setOpen(true)}
      className={cn(
        'h-10 flex-row items-center justify-between rounded-md border px-3',
        'bg-white dark:bg-gray-900',
        'border-gray-200 dark:border-gray-700',
        className,
      )}
    >
      {children}
      <ChevronDown
        size={16}
        color={
          isDark ? colors.mutedForeground.dark : colors.mutedForeground.light
        }
      />
    </Pressable>
  )
}

/* ------------------------------------------------------------------ */
/* Value */
/* ------------------------------------------------------------------ */

function SelectValue({
  placeholder,
  className,
  children,
}: {
  placeholder?: string
  className?: string
  children?: React.ReactNode
}) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  // If children is provided, use it (for custom display like branch name)
  if (children !== undefined) {
    return (
      <Text
        className={cn(
          'flex-1 text-sm',
          children ? 'text-gray-900 dark:text-gray-50' : 'text-gray-400',
          className,
        )}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {children || placeholder}
      </Text>
    )
  }

  // Otherwise, use value from context (slug)
  return (
    <Text
      className={cn(
        'flex-1 text-sm',
        ctx.value ? 'text-gray-900 dark:text-gray-50' : 'text-gray-400',
        className,
      )}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {ctx.value || placeholder}
    </Text>
  )
}

/* ------------------------------------------------------------------ */
/* Content */
/* ------------------------------------------------------------------ */

function SelectContent({
  children,
  className,
  noModal = false,
}: {
  children: React.ReactNode
  className?: string
  noModal?: boolean
}) {
  const ctx = React.useContext(SelectContext)

  // Shared values for UI thread animations
  const scale = useSharedValue(0.95)
  const opacity = useSharedValue(0)

  // Animated style running on UI thread (must be called before any early returns)
  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }
  })

  useEffect(() => {
    if (!ctx?.open) {
      // Reset when closed
      scale.value = 0.95
      opacity.value = 0
      return
    }

    // Animate in (UI thread) — SPRING_CONFIGS.popover
    scale.value = withSpring(1, SPRING_CONFIGS.popover)
    opacity.value = withSpring(1, SPRING_CONFIGS.popover)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.open])

  if (!ctx) return null

  // If noModal is true, render content directly without Modal (for use inside DropdownMenu)
  if (noModal) {
    if (!ctx.open) return null
    return (
      <Animated.View
        style={animatedStyle}
        className={cn('max-h-[300px]', className)}
      >
        <ScrollView>{children}</ScrollView>
      </Animated.View>
    )
  }

  return (
    <Modal transparent visible={ctx.open} animationType="none">
      {/* overlay */}
      <Pressable
        className="flex-1 bg-black/30"
        onPress={() => ctx.setOpen(false)}
      />

      {/* dropdown */}
      <Animated.View
        style={animatedStyle}
        className={cn(
          'absolute top-20 max-h-[300px] w-[90%] self-center',
          'bg-white dark:bg-gray-900',
          'border border-gray-200 dark:border-gray-700',
          'rounded-md shadow-xl',
          className,
        )}
      >
        <ScrollView>{children}</ScrollView>
      </Animated.View>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Item */
/* ------------------------------------------------------------------ */

function SelectItem({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(SelectContext)
  const isDark = useColorScheme() === 'dark'
  if (!ctx) return null

  const selected = ctx.value === value

  return (
    <TouchableOpacity
      onPress={() => {
        ctx.setValue(value)
        ctx.setOpen(false)
      }}
      className={cn(
        'h-10 flex-row items-center px-3',
        selected && 'bg-gray-100 dark:bg-gray-800',
        className,
      )}
    >
      <Text className="flex-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </Text>

      {selected && <Check size={16} color={isDark ? '#60a5fa' : '#3b82f6'} />}
    </TouchableOpacity>
  )
}

/* ------------------------------------------------------------------ */
/* Group */
/* ------------------------------------------------------------------ */

function SelectGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <View className={cn('flex-col', className)}>{children}</View>
}

/* ------------------------------------------------------------------ */
/* Label */
/* ------------------------------------------------------------------ */

function SelectLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  // const isDark = useColorScheme() === 'dark'
  return (
    <Text
      className={cn(
        'px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400',
        className,
      )}
    >
      {children}
    </Text>
  )
}

/* ------------------------------------------------------------------ */
/* Export (shadcn pattern) */
/* ------------------------------------------------------------------ */

Select.Trigger = SelectTrigger
Select.Value = SelectValue
Select.Content = SelectContent
Select.Item = SelectItem
Select.Group = SelectGroup
Select.Label = SelectLabel

export { Select }
