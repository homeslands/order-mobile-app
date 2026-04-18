import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { generatePaymentQR } from '@/api/payment'
import type { IQRGenerateResponse } from '@/types/qr-payment.type'

export const QR_TTL_S = 60
const REFRESH_INTERVAL_S = 55

interface QRFetchState {
  token: string | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
}

export function useQRPayment(): QRFetchState & {
  countdown: number
  refetch: () => void
} {
  // Split into two useState: fetch state (rare updates) + countdown (every second)
  // This confines countdown re-renders to a lightweight path — QRCard/Instructions
  // receive stable fetch props and memo actually suppresses their re-renders.
  const [fetchState, setFetchState] = useState<QRFetchState>({
    token: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
  })
  const [countdown, setCountdown] = useState(QR_TTL_S)

  // Mutable refs — không trigger re-render
  const refs = useRef({
    expiresAtMs: 0,
    isFetching: false,
    isStopped: false, // Fix 4 (MED): guard in-flight fetch after stopTimers
    refreshTimer: null as ReturnType<typeof setInterval> | null,
    countdownTimer: null as ReturnType<typeof setInterval> | null,
    appState: AppState.currentState as AppStateStatus,
  })

  // ─── Timer helpers ────────────────────────────────────────────────────────

  const stopTimers = useCallback(() => {
    const r = refs.current
    r.isStopped = true
    if (r.refreshTimer) {
      clearInterval(r.refreshTimer)
      r.refreshTimer = null
    }
    if (r.countdownTimer) {
      clearInterval(r.countdownTimer)
      r.countdownTimer = null
    }
  }, [])

  const startCountdown = useCallback(() => {
    const r = refs.current
    if (r.countdownTimer) clearInterval(r.countdownTimer)
    r.countdownTimer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((r.expiresAtMs - Date.now()) / 1000),
      )
      // Skip re-render when countdown value unchanged
      setCountdown((prev) => (prev === remaining ? prev : remaining))
    }, 1000)
  }, [])

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchQR = useCallback(
    async (isRefresh: boolean) => {
      const r = refs.current
      if (r.isFetching) return
      r.isFetching = true
      r.isStopped = false

      setFetchState((s) =>
        isRefresh
          ? { ...s, isRefreshing: true }
          : { ...s, isLoading: true, error: null },
      )

      try {
        const res = await generatePaymentQR()
        const data: IQRGenerateResponse = res.result
        r.expiresAtMs = new Date(data.expiresAt).getTime()
        setFetchState({
          token: data.token,
          error: null,
          isLoading: false,
          isRefreshing: false,
        })
        setCountdown(QR_TTL_S)
        // Guard: skip if stopTimers() was called while fetch was in-flight
        if (!r.isStopped) startCountdown()
      } catch {
        setFetchState((s) => ({
          ...s,
          error: 'Không thể tạo mã QR. Vui lòng thử lại.',
          isLoading: false,
          isRefreshing: false,
        }))
      } finally {
        r.isFetching = false
      }
    },
    [startCountdown],
  )

  // ─── Auto-refresh ─────────────────────────────────────────────────────────

  const startAutoRefresh = useCallback(() => {
    const r = refs.current
    if (r.refreshTimer) clearInterval(r.refreshTimer)
    r.refreshTimer = setInterval(() => {
      if (r.appState === 'active') fetchQR(true)
    }, REFRESH_INTERVAL_S * 1000)
  }, [fetchQR])

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    stopTimers() // guard against double-mount / StrictMode
    fetchQR(false)
    startAutoRefresh()
    return stopTimers
  }, [fetchQR, startAutoRefresh, stopTimers])

  // AppState: resume khi foreground, refetch nếu QR đã hết hạn
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      refs.current.appState = next
      if (next === 'active') {
        const remaining = Math.round(
          (refs.current.expiresAtMs - Date.now()) / 1000,
        )
        if (remaining <= 0) {
          stopTimers()
          fetchQR(false)
          startAutoRefresh()
        }
      }
    })
    return () => sub.remove()
  }, [fetchQR, startAutoRefresh, stopTimers])

  // ─── Public API ───────────────────────────────────────────────────────────

  const refetch = useCallback(() => {
    stopTimers()
    setFetchState((s) => ({ ...s, token: null, isLoading: true, error: null }))
    fetchQR(false)
    startAutoRefresh()
  }, [fetchQR, startAutoRefresh, stopTimers])

  return { ...fetchState, countdown, refetch }
}
