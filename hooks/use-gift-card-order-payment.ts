/**
 * useGiftCardOrderPayment — FCM-based payment status watcher for card orders.
 *
 * - Refetch triggers: FCM CARD_ORDER_PAID, useFocusEffect, manual
 * - processedRef deduplicates the same notification
 * - useCardOrderPolling: kiểm tra định kỳ giãn dần trong lúc QR còn hạn, như
 *   màn thanh toán đơn đồ uống — push không tới thì màn vẫn tự chuyển.
 */
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useRef } from 'react'

import { NotificationMessageCode } from '@/constants'
import { POLL_INTERVALS_MS } from '@/hooks/use-payment-status-detector'
import { useNotificationStore } from '@/stores/notification.store'
import { useCardOrderBySlug } from './use-card-order'

export function useGiftCardOrderPayment(
  cardOrderSlug: string | null | undefined,
) {
  const { data: order, isPending, refetch } = useCardOrderBySlug(cardOrderSlug)

  // Refetch on screen focus — catches background FCM that didn't go through store
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  // FCM-based refetch — dedup via processedRef
  const processedRef = useRef<Set<string>>(new Set())
  const latestNotification = useNotificationStore((s) => s.notifications[0])

  useEffect(() => {
    if (!latestNotification || latestNotification.isRead) return
    if (processedRef.current.has(latestNotification.slug)) return
    if (
      latestNotification.message === NotificationMessageCode.CARD_ORDER_PAID
    ) {
      processedRef.current.add(latestNotification.slug)
      void refetch()
    }
  }, [latestNotification, refetch])

  return { order, isPending, refetch }
}

/** Kiểm tra định kỳ (10s → 30s) khi `enabled`; dừng khi tắt hoặc rời màn. */
export function useCardOrderPolling(refetch: () => unknown, enabled: boolean) {
  const refetchRef = useRef(refetch)
  useEffect(() => {
    refetchRef.current = refetch
  }, [refetch])

  useEffect(() => {
    if (!enabled) return
    let tick = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      const delay =
        POLL_INTERVALS_MS[Math.min(tick, POLL_INTERVALS_MS.length - 1)]
      timeoutId = setTimeout(() => {
        void refetchRef.current()
        tick += 1
        schedule()
      }, delay)
    }
    schedule()
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [enabled])
}
