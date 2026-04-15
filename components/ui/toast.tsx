import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react-native'
import React, { useEffect } from 'react'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SPRING_CONFIGS, colors } from '@/constants'

interface ToastData {
  id: string
  title: string
  message?: string
  type: 'info' | 'error' | 'success' | 'warning'
  duration: number
}

interface ToastItemProps {
  toast: ToastData
  onHide: (id: string) => void
}

const ICON_MAP = {
  error:   <XCircle   size={16} color="#dc2626" />,
  success: <CheckCircle size={16} color="#16a34a" />,
  warning: <AlertCircle size={16} color="#d97706" />,
  info:    <Info       size={16} color="#2563eb" />,
} as const

const ToastItem = React.memo(function ToastItem({ toast, onHide }: ToastItemProps) {
  const translateY = useSharedValue(-80)
  const opacity    = useSharedValue(0)
  const insets     = useSafeAreaInsets()
  const isDark     = useColorScheme() === 'dark'

  useEffect(() => {
    translateY.value = -80
    opacity.value    = 0

    const delayMs    = toast.duration * 1000
    const hideCallback = (finished?: boolean) => {
      'worklet'
      if (finished) runOnJS(onHide)(toast.id)
    }

    translateY.value = withSequence(
      withSpring(0, SPRING_CONFIGS.modal),
      withDelay(delayMs, withSpring(-80, SPRING_CONFIGS.modal)),
    )
    opacity.value = withSequence(
      withSpring(1, SPRING_CONFIGS.modal),
      withDelay(delayMs, withSpring(0, SPRING_CONFIGS.modal, hideCallback)),
    )
    return () => {
      cancelAnimation(translateY)
      cancelAnimation(opacity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration, onHide])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  const bg = isDark ? colors.gray[800] : '#ffffff'
  const textColor = isDark ? colors.gray[50] : colors.gray[900]

  return (
    <Animated.View
      style={[s.container, { top: insets.top + 12 }, animatedStyle]}
      pointerEvents="none"
    >
      <View style={[s.pill, { backgroundColor: bg }]}>
        {ICON_MAP[toast.type]}
        {toast.message ? (
          <Text style={[s.message, { color: textColor }]} numberOfLines={2}>
            {toast.message}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  )
})

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    maxWidth: 320,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
})

export default ToastItem
export type { ToastData }
