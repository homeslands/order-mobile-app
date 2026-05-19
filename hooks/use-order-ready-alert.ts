import { useCallback, useState } from 'react'

import { NotificationMessageCode } from '@/constants/notification.constant'
import { useNotificationStore } from '@/stores/notification.store'

interface OrderReadyAlertState {
  isVisible: boolean
  title: string
  body: string
}

const HIDDEN: OrderReadyAlertState = { isVisible: false, title: '', body: '' }

function markLatestOrderReadyAsRead() {
  const store = useNotificationStore.getState()
  // Find the newest unread ORDER_NEEDS_READY_TO_GET entry — notifications are
  // prepended, so the first match in the array is the most recent.
  const target = store.notifications.find(
    (n) =>
      !n.isRead && n.message === NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
  )
  if (target) store.markAsRead(target.slug)
}

export function useOrderReadyAlert() {
  const [state, setState] = useState<OrderReadyAlertState>(HIDDEN)

  const show = useCallback((title: string, body: string) => {
    setState({ isVisible: true, title, body })
    // User has unmistakably seen this notification — mark it read immediately
    // so badge and list reflect that without waiting for a manual tap.
    markLatestOrderReadyAsRead()
  }, [])

  const hide = useCallback(() => {
    setState(HIDDEN)
  }, [])

  return { ...state, show, hide }
}
