import { useEffect, useRef } from 'react'

import { NotificationMessageCode, PaymentMethod } from '@/constants'
import { useNotificationStore } from '@/stores'
import { OrderStatus } from '@/types'

// Notification codes that indicate a customer order was paid.
export const PAID_NOTIFICATION_CODES = new Set<string>([
  NotificationMessageCode.ORDER_PAID,
  NotificationMessageCode.CARD_ORDER_PAID,
])

// Stepped backoff delays for BANK_TRANSFER polling (milliseconds).
// Index maps to tick number; last entry is the permanent cap.
const POLL_INTERVALS_MS = [10_000, 15_000, 20_000, 30_000] as const

export interface UsePaymentStatusDetectorOptions {
  /** Slug of the order being paid. */
  orderSlug: string
  /** Currently submitted payment method. null = payment not yet submitted. */
  method: PaymentMethod | null
  /**
   * Set to Date.now() when executePayment.onSuccess fires; null otherwise.
   * Changing this value resets the BANK_TRANSFER polling interval to tick 0.
   */
  submittedAt: number | null
  /** Latest order.status from the API — detects PAID after a poll refetch. */
  orderStatus: OrderStatus | undefined
  /**
   * Called when payment is confirmed or when a background sync is needed.
   * BANK_TRANSFER: called on each poll tick and when FCM arrives.
   * POINT: called once for silent background sync after optimistic success.
   */
  onPaid: () => void
}

export function usePaymentStatusDetector({
  orderSlug,
  method,
  submittedAt,
  orderStatus,
  onPaid,
}: UsePaymentStatusDetectorOptions): { showSuccess: boolean } {
  // Stable ref so effects always call the latest onPaid without re-subscribing.
  const onPaidRef = useRef(onPaid)
  useEffect(() => {
    onPaidRef.current = onPaid
  }, [onPaid])

  // ── FCM detection ─────────────────────────────────────────────────────────
  // Returns a boolean — Zustand skips re-render when the value hasn't changed.
  const fcmDetected = useNotificationStore((s) =>
    s.notifications.some(
      (n) =>
        !n.isRead &&
        PAID_NOTIFICATION_CODES.has(n.message) &&
        n.metadata?.order === orderSlug,
    ),
  )

  // ── showSuccess derivation ────────────────────────────────────────────────
  // POINT: API 200 = server confirmed → optimistic success, no rollback needed.
  const optimisticPaid = method === PaymentMethod.POINT && submittedAt !== null
  const showSuccess =
    fcmDetected || optimisticPaid || orderStatus === OrderStatus.PAID

  // Latest showSuccess in a ref so setTimeout callbacks avoid stale closures.
  const showSuccessRef = useRef(showSuccess)
  useEffect(() => {
    showSuccessRef.current = showSuccess
  }, [showSuccess])

  // ── BANK_TRANSFER: stepped backoff polling ────────────────────────────────
  // Starts when submittedAt is set and payment not yet detected.
  // Cleanup (effect teardown) cancels the pending timeout when showSuccess
  // becomes true — prevents a stale tick firing after success.
  useEffect(() => {
    if (
      method !== PaymentMethod.BANK_TRANSFER ||
      submittedAt === null ||
      showSuccess
    )
      return

    let tickIndex = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (showSuccessRef.current) return
      const delay =
        POLL_INTERVALS_MS[Math.min(tickIndex, POLL_INTERVALS_MS.length - 1)]
      timeoutId = setTimeout(() => {
        if (showSuccessRef.current) return
        onPaidRef.current()
        tickIndex += 1
        schedule()
      }, delay)
    }

    schedule()

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [method, submittedAt, showSuccess])

  // ── BANK_TRANSFER: sync order state when FCM arrives ─────────────────────
  // fcmDetected=true already sets showSuccess, but the parent still needs a
  // refetch so invoice/receipt fields are populated in the success screen.
  // runOnJS is not needed here — useNotificationStore selector fires on JS thread.
  const prevFcmRef = useRef(false)
  useEffect(() => {
    if (
      !prevFcmRef.current &&
      fcmDetected &&
      method === PaymentMethod.BANK_TRANSFER
    ) {
      onPaidRef.current()
    }
    prevFcmRef.current = fcmDetected
  }, [fcmDetected, method])

  // ── POINT: silent background sync ─────────────────────────────────────────
  // Optimistic flag shows success instantly; one refetch syncs order.status
  // in the parent's React Query cache so order detail shows PAID correctly.
  useEffect(() => {
    if (method !== PaymentMethod.POINT || submittedAt === null) return
    onPaidRef.current()
  }, [method, submittedAt])

  return { showSuccess }
}
