import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, Platform, Pressable, StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const DUR_OPEN = 200
const DUR_CLOSE = 140

interface LightweightDialogProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode | ((dismiss: () => void) => React.ReactNode)
}

export const LightweightDialog = memo(function LightweightDialog({
  visible,
  onClose,
  children,
}: LightweightDialogProps) {
  const progress = useSharedValue(0)
  const [show, setShow] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const unmount = useCallback(() => {
    setShow(false)
    onCloseRef.current()
  }, [])

  const dismiss = useCallback(() => {
    cancelAnimation(progress)
    // eslint-disable-next-line react-hooks/immutability -- SharedValue.value mutation is the intended Reanimated API
    progress.value = withTiming(0, { duration: DUR_CLOSE }, (fin) => {
      if (fin) runOnJS(unmount)()
    })
  }, [progress, unmount])

  useEffect(() => {
    if (visible) {
      setShow(true)
      cancelAnimation(progress)
      // Start from 0 on next frame so layout is ready
      // eslint-disable-next-line react-hooks/immutability -- SharedValue.value mutation is the intended Reanimated API
      progress.value = 0
      requestAnimationFrame(() => {
        progress.value = withTiming(1, { duration: DUR_OPEN })
      })
    } else if (!visible && show) {
      dismiss()
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss()
      return true
    })
    return () => sub.remove()
  }, [show, dismiss])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }))

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.88 + 0.12 * progress.value }],
  }))

  if (!show) return null

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, ld.overlay]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, ld.backdrop, backdropStyle]}
        renderToHardwareTextureAndroid
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>
      <Animated.View
        style={[ld.center, cardStyle]}
        pointerEvents="box-none"
        renderToHardwareTextureAndroid
        {...(Platform.OS === 'ios' && { shouldRasterizeIOS: true })}
      >
        {typeof children === 'function' ? children(dismiss) : children}
      </Animated.View>
    </Animated.View>
  )
})

const ld = StyleSheet.create({
  overlay: {
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
})
