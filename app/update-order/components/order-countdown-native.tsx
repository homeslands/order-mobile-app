import dayjs from 'dayjs'
import { Timer } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, useColorScheme } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import { colors } from '@/constants'

const ORDER_TIMEOUT_SECONDS = 900 // 15 minutes
const WARNING_THRESHOLD_SEC = 120
const CRITICAL_THRESHOLD_SEC = 60

function calcRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function formatCountdown(sec: number, prefix: string): string {
  if (sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${prefix}${m}:${s < 10 ? '0' : ''}${s}`
}

interface OrderCountdownNativeProps {
  createdAt: string | undefined
  setIsExpired: (value: boolean) => void
}

const OrderCountdownNative = memo(function OrderCountdownNative({
  createdAt,
  setIsExpired,
}: OrderCountdownNativeProps) {
  const isDark = useColorScheme() === 'dark'
  const { t } = useTranslation('payment')
  const prefix = t('countdown.remaining')

  const expiresAt = createdAt
    ? dayjs(createdAt).add(ORDER_TIMEOUT_SECONDS, 'second').toISOString()
    : undefined

  const [seconds, setSeconds] = useState(() =>
    expiresAt ? calcRemaining(expiresAt) : 0,
  )

  const onExpiredRef = useRef(setIsExpired)
  useEffect(() => { onExpiredRef.current = setIsExpired })

  useEffect(() => {
    if (!expiresAt) return

    const initial = calcRemaining(expiresAt)
    if (initial <= 0) {
      onExpiredRef.current(true)
      return
    }

    const id = setInterval(() => {
      const remaining = calcRemaining(expiresAt)
      setSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        onExpiredRef.current(true)
      }
    }, 1000)

    return () => clearInterval(id)
  }, [expiresAt])

  const handleFireExpired = useCallback(() => {
    onExpiredRef.current(true)
  }, [])
  void handleFireExpired

  const primary = isDark ? colors.primary.dark : colors.primary.light
  const barStyle = useAnimatedStyle(() => {
    let bg = primary
    if (seconds <= CRITICAL_THRESHOLD_SEC && seconds > 0)
      bg = isDark ? colors.destructive.dark : colors.destructive.light
    else if (seconds <= WARNING_THRESHOLD_SEC && seconds > 0)
      bg = isDark ? colors.warning.dark : colors.warning.light
    return { backgroundColor: bg }
  }, [seconds, isDark, primary])

  return (
    <Animated.View style={[cs.bar, barStyle]}>
      <Timer size={13} color={colors.white.light} />
      <Text style={cs.text}>{formatCountdown(seconds, prefix)}</Text>
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
  },
})
