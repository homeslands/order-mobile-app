import { useEffect, useRef, useState } from 'react'

interface UseCountdownOptions {
  expiresAt?: string
  enabled?: boolean
}

function calcTimeLeft(expiresAt: string): number {
  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  )
}

/**
 * Reusable countdown hook for ISO expiration timestamps
 * According to docs:
 * - OTP: 10 minutes (expiresAt from API)
 * - JWT: 5 minutes (calculated: now + 5min)
 *
 * Uses a tick counter to drive re-renders; seconds are derived at render time
 * from expiresAt — avoids synchronous setState inside an effect body.
 */
export function useCountdown({
  expiresAt,
  enabled = true,
}: UseCountdownOptions) {
  // Tick counter — incremented by the interval to force re-renders
  const [, setTick] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expiresAtRef = useRef(expiresAt)

  useEffect(() => {
    expiresAtRef.current = expiresAt
  })

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!enabled || !expiresAt || calcTimeLeft(expiresAt) <= 0) return

    timerRef.current = setInterval(() => {
      setTick((t) => t + 1)
      if (expiresAtRef.current && calcTimeLeft(expiresAtRef.current) <= 0) {
        clearInterval(timerRef.current!)
        timerRef.current = null
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [expiresAt, enabled])

  // Derive seconds at render time — no stored state needed
  return enabled && expiresAt ? calcTimeLeft(expiresAt) : 0
}
