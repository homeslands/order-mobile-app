import React, { useMemo } from 'react'
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated'
import { Text } from 'react-native'
import { colors } from '@/constants'

interface AnimatedCountdownTextProps {
  countdownShared: SharedValue<number>
  label?: string
  className?: string
  warningThreshold?: number // Color changes when below this (default: 60 seconds)
}

/**
 * Animated Countdown Text Component
 * Displays countdown with dynamic color based on time remaining
 * Runs entirely on UI thread - no JS blocking
 *
 * Color changes:
 * - Normal: Muted foreground color
 * - Warning (< 60s): Primary color
 * - Critical (< 10s): Destructive color
 */
export const AnimatedCountdownText = React.memo(
  ({
    countdownShared,
    label = '',
    className = '',
    warningThreshold = 60,
  }: AnimatedCountdownTextProps) => {
    // Animated style that changes color based on countdown value
    const animatedStyle = useAnimatedStyle(() => {
      const seconds = countdownShared.value

      // Color logic:
      // > 60s: muted-foreground (gray)
      // 10-60s: primary (blue)
      // < 10s: destructive (red)

      let textColor: string

      if (seconds <= 10) {
        // Critical: Red
        textColor = colors.destructive.light
      } else if (seconds <= warningThreshold) {
        // Warning: Primary blue
        textColor = colors.primary.light
      } else {
        // Normal: Muted gray
        textColor = colors.mutedForeground.light
      }

      return {
        color: textColor,
      }
    })

    // Memoize label text to prevent unnecessary renders
    const labelText = useMemo(() => {
      if (!label) return ''
      return `${label}: `
    }, [label])

    return (
      <Animated.Text
        style={[animatedStyle]}
        className={`text-center text-sm font-sans text-muted-foreground ${className}`}
      >
        <Text>{labelText}</Text>
        <AnimatedTime countdownShared={countdownShared} />
      </Animated.Text>
    )
  }
)

AnimatedCountdownText.displayName = 'AnimatedCountdownText'

/**
 * Helper component that displays the actual time
 * Separated to optimize rendering
 */
const AnimatedTime = React.memo(
  ({ countdownShared }: { countdownShared: SharedValue<number> }) => {
    // Note: Reanimated Text doesn't support dynamic text updates on UI thread
    // So we fall back to using a regular Text component with JS update
    // This is a limitation of React Native - text content must be JS thread
    const [displayTime, setDisplayTime] = React.useState('0:00')

    // Use Reanimated's animated reaction to update display when value changes
    useAnimatedReaction(
      () => Math.floor(countdownShared.value),
      (current) => {
        if (current !== undefined) {
          const m = Math.floor(current / 60)
          const s = current % 60
          const newTime = `${m}:${String(s).padStart(2, '0')}`
          runOnJS(setDisplayTime)(newTime)
        }
      },
    )

    return <Text>{displayTime}</Text>
  }
)

AnimatedTime.displayName = 'AnimatedTime'

/**
 * Simplified version for just color animation
 * Use this if you already have the time formatting elsewhere
 */
export const AnimatedCountdownColor = React.memo(
  ({
    countdownShared,
    children,
    className = '',
    warningThreshold = 60,
  }: {
    countdownShared: SharedValue<number>
    children: React.ReactNode
    className?: string
    warningThreshold?: number
  }) => {
    const animatedStyle = useAnimatedStyle(() => {
      const seconds = countdownShared.value

      let textColor: string

      if (seconds <= 10) {
        textColor = colors.destructive.light
      } else if (seconds <= warningThreshold) {
        textColor = colors.primary.light
      } else {
        textColor = colors.mutedForeground.light
      }

      return {
        color: textColor,
      }
    })

    return (
      <Animated.Text style={[animatedStyle]} className={className}>
        {children}
      </Animated.Text>
    )
  }
)

AnimatedCountdownColor.displayName = 'AnimatedCountdownColor'
