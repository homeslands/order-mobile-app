/**
 * useGiftCardOrderPayment — FCM-based payment status watcher for card orders.
 *
 * Mirrors the pattern in app/payment/[order].tsx:
 * - NO setInterval polling (battery drain)
 * - Refetch triggers: FCM CARD_ORDER_PAID, useFocusEffect, manual
 * - processedRef deduplicates the same notification
 */
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useRef } from 'react'

import { NotificationMessageCode } from '@/constants'
import { useNotificationStore } from '@/stores/notification.store'
import { useCardOrderBySlug } from './use-card-order'

export function useGiftCardOrderPayment(cardOrderSlug: string | null | undefined) {
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
      latestNotification.message === NotificationMessageCode.CARD_ORDER_PAID &&
      latestNotification.metadata?.order === cardOrderSlug
    ) {
      processedRef.current.add(latestNotification.slug)
      void refetch()
    }
  }, [latestNotification, cardOrderSlug, refetch])

  return { order, isPending, refetch }
}
