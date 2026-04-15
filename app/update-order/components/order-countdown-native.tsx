import dayjs from 'dayjs'
import { Timer } from 'lucide-react-native'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'

import { colors } from '@/constants'

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
  const [timeRemainingInSec, setTimeRemainingInSec] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { bgColor, timeStr } = useMemo(() => {
    const m = Math.floor(timeRemainingInSec / 60)
    const s = timeRemainingInSec % 60
    const str = `${m}:${s < 10 ? `0${s}` : s}`
    const primary = isDark ? colors.primary.dark : colors.primary.light
    let color = primary
    if (timeRemainingInSec <= CRITICAL_THRESHOLD_SEC && timeRemainingInSec > 0)
      color = isDark ? colors.destructive.dark : colors.destructive.light
    else if (timeRemainingInSec <= WARNING_THRESHOLD_SEC)
      color = isDark ? colors.warning.light : colors.warning.dark
    return { bgColor: color, timeStr: str }
  }, [timeRemainingInSec, isDark])

  useEffect(() => {
    if (!createdAt || typeof createdAt !== 'string') return

    const tick = () => {
      try {
        const createTime = dayjs(createdAt)
        if (!createTime.isValid()) return
        const remaining = 900 - dayjs().diff(createTime, 'seconds')
        if (remaining <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          setTimeRemainingInSec(0)
          setIsExpired(true)
        } else {
          setTimeRemainingInSec(remaining)
        }
      } catch { /* ignore */ }
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [createdAt, setIsExpired])

  return (
    <View style={[cs.bar, { backgroundColor: bgColor }]}>
      <Timer size={13} color={colors.white.light} />
      <Text style={cs.text}>Còn {timeStr}</Text>
    </View>
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
  text: { fontSize: 13, fontWeight: '600', color: colors.white.light },
})
