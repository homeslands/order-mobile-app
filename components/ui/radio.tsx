import { cn } from '@/lib/utils'
import React, { createContext, useContext, useEffect } from 'react'
import { Pressable, View, useColorScheme } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { colors, SPRING_CONFIGS } from '@/constants'

interface RadioGroupContextType {
  value?: string
  onValueChange?: (value: string) => void
}

const RadioGroupContext = createContext<RadioGroupContextType | null>(null)

interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

/**
 * RadioGroup - Container for radio items
 * Similar to shadcn UI RadioGroup
 */
function RadioGroup({ value, onValueChange, children, className }: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <View className={cn('flex-col', className)}>
        {children}
      </View>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps {
  value: string
  id?: string
  disabled?: boolean
  className?: string
  onPress?: () => void
}

/**
 * RadioGroupItem - Individual radio button
 * Similar to shadcn UI RadioGroupItem
 */
function RadioGroupItem({ value, disabled = false, className, onPress }: RadioGroupItemProps) {
  const context = useContext(RadioGroupContext)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const isSelected = context?.value === value
  const indicatorScale = useSharedValue(isSelected ? 1 : 0)

  useEffect(() => {
    indicatorScale.value = withSpring(isSelected ? 1 : 0, SPRING_CONFIGS.press)
  }, [isSelected, indicatorScale])

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: indicatorScale.value }],
  }))

  const handlePress = () => {
    if (!disabled && context?.onValueChange) {
      context.onValueChange(value)
    }
    if (onPress) {
      onPress()
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      className={cn(
        'h-4 w-4 rounded-full border-2 items-center justify-center',
        isSelected
          ? 'border-primary'
          : 'border-gray-300 dark:border-gray-600',
        disabled && 'opacity-50',
        className
      )}
      style={{
        borderColor: isSelected
          ? '#3b82f6'
          : (isDark ? colors.gray[600] : colors.gray[300]),
      }}
    >
      {isSelected && (
        <Animated.View
          style={[
            indicatorAnimatedStyle,
            {
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#3b82f6',
            },
          ]}
        />
      )}
    </Pressable>
  )
}

export { RadioGroup, RadioGroupItem }

