/**
 * Task 5 — Layer 4: Tab Bar với MasterProgress.
 * Fade in/out cùng transition. progress 0 = tab, 1 = stack. opacity = 1 - progress.
 */
import React from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useMasterTransitionOptional } from '@/lib/navigation'

type TabBarWithTransitionProps = {
  children: React.ReactNode
  style?: object
}

export function TabBarWithTransition({ children, style }: TabBarWithTransitionProps) {
  const master = useMasterTransitionOptional()

  const animatedStyle = useAnimatedStyle(
    () => ({
      opacity: master ? 1 - master.transitionProgress.value : 1,
    }),
    [master],
  )

  if (!master) {
    return <View style={style}>{children}</View>
  }

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  )
}
