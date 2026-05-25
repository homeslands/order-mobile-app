import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { markNotificationAsRead } from '@/api/notification'
import {
  NotificationMessageCode,
  ORDER_READY_MAX_AGE_MS,
} from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'

export interface PendingOrder {
  orderSlug: string
  referenceNumber: string
  branchName: string
}

export interface OrderReadyQueue {
  activeOrder: PendingOrder | null
  pendingCount: number
  markDone: (orderSlug: string) => void
  suppressFor: (ms: number) => void
}

const SUPPRESS_BUFFER_MS = 50

export function useOrderReadyQueue(): OrderReadyQueue {
  const allNotifications = useNotificationStore((s) => s.notifications)
  const markAllReadByOrder = useNotificationStore((s) => s.markAllReadByOrder)

  const [suppressVersion, bumpVersion] = useState(0)
  const suppressUntilRef = useRef(0)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    }
  }, [])

  const { activeOrder, pendingCount } = useMemo(() => {
    let oldest: (typeof allNotifications)[number] | null = null
    let oldestTs = Infinity
    let count = 0
    const now = Date.now()
    for (const n of allNotifications) {
      if (n.isRead) continue
      if (n.message !== NotificationMessageCode.ORDER_NEEDS_READY_TO_GET)
        continue
      if (
        now - Date.parse(n.sentAt ?? n.receivedAt ?? n.createdAt) >
        ORDER_READY_MAX_AGE_MS
      )
        continue
      count++
      // sentAt = server time staff pressed call (most accurate).
      // receivedAt = device-local fallback for older FCM without sentAt.
      // createdAt = order creation time, last resort for API-hydrated items.
      const ts = Date.parse(n.sentAt ?? n.receivedAt ?? n.createdAt)
      if (ts < oldestTs) {
        oldestTs = ts
        oldest = n
      }
    }

    const isSuppressed = Date.now() < suppressUntilRef.current
    const activeNotif = isSuppressed ? null : oldest

    const activeOrder: PendingOrder | null = activeNotif
      ? {
          orderSlug: activeNotif.metadata.order,
          referenceNumber: activeNotif.metadata.referenceNumber ?? '',
          branchName: activeNotif.metadata.branchName,
        }
      : null

    return { activeOrder, pendingCount: count }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNotifications, suppressVersion])

  const markDone = useCallback(
    (orderSlug: string) => {
      // Capture slugs before marking read — markAllReadByOrder flips isRead
      // synchronously so the filter below would find nothing if run after.
      const slugsToSync = useNotificationStore
        .getState()
        .notifications.filter(
          (n) => n.metadata.order === orderSlug && !n.isRead,
        )
        .map((n) => n.slug)

      markAllReadByOrder(orderSlug)

      for (const slug of slugsToSync) {
        markNotificationAsRead(slug).catch(() => {})
      }
    },
    [markAllReadByOrder],
  )

  // Bump version only on expiry so the entry path doesn't trigger a
  // re-render mid-navigation when the JS thread is already busy.
  const suppressFor = useCallback((ms: number) => {
    suppressUntilRef.current = Date.now() + ms
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = setTimeout(() => {
      suppressTimerRef.current = null
      bumpVersion((n) => n + 1)
    }, ms + SUPPRESS_BUFFER_MS)
  }, [])

  return { activeOrder, pendingCount, markDone, suppressFor }
}
