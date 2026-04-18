import { cn } from '@/lib/utils'
import { Check } from 'lucide-react-native'
import { useEffect } from 'react'
import { Pressable, useColorScheme } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { colors, SPRING_CONFIGS } from '@/constants'

interface CheckboxProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  checkedBorderColor?: string
  checkedBackgroundColor?: string
  checkedIconColor?: string
}

function Checkbox({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  checkedBorderColor,
  checkedBackgroundColor,
  checkedIconColor,
}: CheckboxProps) {
  const isDark = useColorScheme() === 'dark'
  const iconScale = useSharedValue(checked ? 1 : 0)

  useEffect(() => {
    iconScale.value = withSpring(checked ? 1 : 0, SPRING_CONFIGS.press)
  }, [checked, iconScale])

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }))

  const handlePress = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked)
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      className={cn(
        'h-5 w-5 items-center justify-center rounded border-2',
        checked
          ? 'border-primary bg-primary'
          : 'border-gray-300 dark:border-gray-600',
        disabled && 'opacity-50',
        className,
      )}
      style={{
        borderColor: checked
          ? checkedBorderColor || '#3b82f6'
          : isDark
            ? colors.gray[600]
            : colors.gray[300],
        backgroundColor: checked
          ? checkedBackgroundColor || '#3b82f6'
          : 'transparent',
      }}
    >
      {checked && (
        <Animated.View style={iconAnimatedStyle}>
          <Check size={14} color={checkedIconColor || colors.white.light} />
        </Animated.View>
      )}
    </Pressable>
  )
}

export { Checkbox }
