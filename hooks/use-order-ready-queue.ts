import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'

export interface PendingOrder {
  orderSlug: string
  referenceNumber: string
  branchName: string
}

export interface OrderReadyQueue {
  activeOrder: PendingOrder | null
  /** Total unread ORDER_NEEDS_READY_TO_GET notifications, including currently snoozed ones. */
  pendingCount: number
  snooze: (orderSlug: string) => void
  markDone: (orderSlug: string) => void
  suppressFor: (ms: number) => void
}

// Module-level: persists for JS runtime lifetime (cleared only on app kill).
const snoozeMap = new Map<string, number>() // orderSlug → expireAt ms
const SNOOZE_MS = 90_000
const SUPPRESS_BUFFER_MS = 50

/** Exposed only for test isolation — do NOT call in production code. */
export const _resetSnoozeMapForTests = () => snoozeMap.clear()

function isSnoozing(orderSlug: string): boolean {
  const exp = snoozeMap.get(orderSlug)
  if (!exp) return false
  if (Date.now() >= exp) {
    snoozeMap.delete(orderSlug)
    return false
  }
  return true
}

export function useOrderReadyQueue(): OrderReadyQueue {
  const notifications = useNotificationStore(
    useShallow((s) =>
      s.notifications.filter(
        (n) =>
          !n.isRead &&
          n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
      ),
    ),
  )
  const markAllReadByOrder = useNotificationStore((s) => s.markAllReadByOrder)

  const [, forceUpdate] = useState(0)
  const suppressUntilRef = useRef(0)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-check snooze expiry every 10s so expired orders re-surface.
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 10_000)
    return () => {
      clearInterval(id)
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    }
  }, [])

  // Sort ASC by createdAt → oldest notification surfaces first (FIFO).
  const sorted = [...notifications].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  // eslint-disable-next-line react-hooks/purity -- intentional: current time needed to check suppress window
  const isSuppressed = Date.now() < suppressUntilRef.current
  const activeNotif = isSuppressed
    ? null
    : (sorted.find((n) => !isSnoozing(n.metadata.order)) ?? null)

  const activeOrder: PendingOrder | null = activeNotif
    ? {
        orderSlug: activeNotif.metadata.order,
        referenceNumber: activeNotif.metadata.referenceNumber ?? '',
        branchName: activeNotif.metadata.branchName,
      }
    : null

  const pendingCount = sorted.length

  const snooze = useCallback((orderSlug: string) => {
    snoozeMap.set(orderSlug, Date.now() + SNOOZE_MS)
    // Immediately re-derive activeOrder so the consumer effect sees the
    // updated value synchronously (prevents re-present flicker).
    forceUpdate((n) => n + 1)
  }, [])

  const markDone = useCallback(
    (orderSlug: string) => {
      snoozeMap.delete(orderSlug)
      markAllReadByOrder(orderSlug)
    },
    [markAllReadByOrder],
  )

  const suppressFor = useCallback((ms: number) => {
    suppressUntilRef.current = Date.now() + ms
    // Re-derive activeOrder immediately (suppressed) and again after expiry.
    forceUpdate((n) => n + 1)
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = setTimeout(
      () => forceUpdate((n) => n + 1),
      ms + SUPPRESS_BUFFER_MS,
    )
  }, [])

  return { activeOrder, pendingCount, snooze, markDone, suppressFor }
}
