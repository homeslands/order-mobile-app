/**
 * useNotificationResponse — handle user tapping a notification (background + cold start).
 *
 * expo-notifications fires this for:
 * - Background: user taps system notification while app is in background
 * - Cold start: user taps notification that opens the app from killed state
 *
 * Both cases are handled by the same listener + getLastNotificationResponseAsync.
 */
import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'

import { navigateFromNotification } from '@/lib/notification-navigation'
import { useNotificationStore } from '@/stores/notification.store'

// Giới hạn số notification ID đã xử lý — tránh Set tăng vô hạn trong session dài.
// 100 ID gần nhất là đủ để dedup; notification cũ hơn 100 lần không thể bị fire lại.
const MAX_PROCESSED_IDS = 100

export function useNotificationResponse(enabled = true) {
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier
      // Dedup — avoid processing same notification twice
      if (processedRef.current.has(id)) return
      processedRef.current.add(id)
      // Trim oldest entries khi vượt giới hạn
      if (processedRef.current.size > MAX_PROCESSED_IDS) {
        const oldest = processedRef.current.values().next().value
        if (oldest !== undefined) processedRef.current.delete(oldest)
      }

      const content = response.notification.request.content
      const data = content.data as Record<string, string> | undefined

      // Add notification to store (background FCM never goes through foreground
      // listener, so it won't be in the store yet). This allows screens like the
      // payment screen to detect ORDER_PAID via hasOrderPaidNotification.
      useNotificationStore.getState().addNotification(
        {
          notification: {
            title: content.title ?? undefined,
            body: content.body ?? undefined,
          },
          data: data ?? {},
          messageId: id,
        },
        { markAsRead: false },
      )

      // Navigate to relevant screen
      navigateFromNotification(data)
    }

    // Background tap listener
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse)

    // Cold start: check if app was opened by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response)
    })

    return () => {
      subscription.remove()
    }
  }, [enabled])
}
