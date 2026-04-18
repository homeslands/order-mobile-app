import { useEffect, useRef } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

interface UseAnimatedCountdownOptions {
  expiresAt?: string
  enabled?: boolean
}

/**
 * Animated countdown hook using React Native Reanimated
 * Runs on UI thread, no JS thread blocking
 * No re-renders during countdown
 *
 * According to docs:
 * - OTP: 10 minutes (expiresAt from API)
 * - JWT: 5 minutes (calculated: now + 5min)
 */
export function useAnimatedCountdown({
  expiresAt,
  enabled = true,
}: UseAnimatedCountdownOptions): SharedValue<number> {
  // Shared value runs on UI thread, not JS thread
  // Updates to this value don't trigger re-renders
  const countdownShared = useSharedValue(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Early exit if disabled or no expiration time
    if (!enabled || !expiresAt) {
      countdownShared.value = 0
      return
    }

    // Calculate initial time remaining
    const calculateTimeLeft = () => {
      if (!expiresAt) return 0
      const timeLeft = Math.floor(
        (new Date(expiresAt).getTime() - Date.now()) / 1000,
      )
      return Math.max(0, timeLeft)
    }

    // Set initial value immediately
    countdownShared.value = calculateTimeLeft()

    // Create interval to update every second
    // This runs on UI thread via Reanimated
    timerRef.current = setInterval(() => {
      const timeLeft = calculateTimeLeft()

      // Update shared value (UI thread, no JS blocking)
      countdownShared.value = timeLeft

      // Stop interval when countdown reaches 0
      if (timeLeft <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }, 1000)

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, enabled])

  return countdownShared
}
