import dayjs from 'dayjs'
import { Timer } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, TextInput, useColorScheme } from 'react-native'
import Animated, { runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated'

import { colors } from '@/constants'
import { useAnimatedCountdown } from '@/hooks/use-animated-countdown'

// Animated TextInput — text updates on UI thread, zero re-renders
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const ORDER_TIMEOUT_SECONDS = 900 // 15 minutes

function formatCountdown(sec: number): string {
  'worklet'
  if (sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `Còn ${m}:${s < 10 ? '0' : ''}${s}`
}

interface OrderCountdownNativeProps {
  createdAt: string | undefined
  setIsExpired: (value: boolean) => void
}

const WARNING_THRESHOLD_SEC = 120
const CRITICAL_THRESHOLD_SEC = 60

const OrderCountdownNative = memo(function OrderCountdownNative({
  createdAt,
  setIsExpired,
}: OrderCountdownNativeProps) {
  const isDark = useColorScheme() === 'dark'
  const onExpiredRef = useRef(setIsExpired)
  useEffect(() => { onExpiredRef.current = setIsExpired })

  // Convert createdAt → expiresAt for the hook
  const expiresAt = useMemo(() => {
    if (!createdAt) return undefined
    const d = dayjs(createdAt)
    if (!d.isValid()) return undefined
    return d.add(ORDER_TIMEOUT_SECONDS, 'second').toISOString()
  }, [createdAt])

  // SharedValue — updates on UI thread, zero re-renders
  const secondsShared = useAnimatedCountdown({ expiresAt, enabled: !!expiresAt })

  // Handle already-expired on mount
  useEffect(() => {
    if (!expiresAt) return
    const remaining = dayjs(expiresAt).diff(dayjs(), 'second')
    if (remaining <= 0) onExpiredRef.current(true)
  }, [expiresAt])

  // Bridge expiry from UI thread → JS
  const fireExpired = useCallback(() => { onExpiredRef.current(true) }, [])
  useAnimatedReaction(
    () => secondsShared.value,
    (current, previous) => {
      if (current === 0 && previous !== null && previous > 0) {
        runOnJS(fireExpired)()
      }
    },
  )

  // Background color — reactive on UI thread
  const barStyle = useAnimatedStyle(() => {
    const sec = secondsShared.value
    const primary = isDark ? colors.primary.dark : colors.primary.light
    let bg = primary
    if (sec <= CRITICAL_THRESHOLD_SEC && sec > 0)
      bg = isDark ? colors.destructive.dark : colors.destructive.light
    else if (sec <= WARNING_THRESHOLD_SEC && sec > 0)
      bg = isDark ? colors.warning.light : colors.warning.dark
    return { backgroundColor: bg }
  }, [isDark])

  // Text — formatted on UI thread
  const textProps = useAnimatedProps(() => ({
    value: formatCountdown(secondsShared.value),
  }))

  return (
    <Animated.View style={[cs.bar, barStyle]}>
      <Timer size={13} color={colors.white.light} />
      <AnimatedTextInput
        animatedProps={textProps}
        editable={false}
        pointerEvents="none"
        style={cs.text}
      />
    </Animated.View>
  )
})

export default OrderCountdownNative

const cs = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white.light,
    padding: 0,
    textAlign: 'center',
  },
})
