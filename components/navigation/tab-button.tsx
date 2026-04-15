import React, { useEffect } from 'react'
import { GestureResponderEvent, Pressable, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

// Định nghĩa Type thay vì any
interface TabButtonProps {
  active: boolean
  onPress: (event: GestureResponderEvent) => void
  children: React.ReactNode
}

const SPRING_CONFIG = {
  stiffness: 180,
  damping: 25,
  mass: 0.6,
}

export const TabButton = ({ active, onPress, children }: TabButtonProps) => {
  const animValue = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    // Luôn chạy trên UI Thread nhờ Reanimated
    animValue.value = withSpring(active ? 1 : 0, SPRING_CONFIG)
  }, [active, animValue])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: animValue.value * -8 },
      { scale: 1 + animValue.value * 0.15 },
    ],
    opacity: 0.8 + animValue.value * 0.2,
  }))

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Animated.View style={[styles.iconBox, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
