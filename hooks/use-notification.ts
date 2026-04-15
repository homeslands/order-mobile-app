/**
 * Notification API hooks — fetch list (paginated) + mark as read.
 */
import { useMutation, useQuery } from '@tanstack/react-query'

import { getNotifications, markNotificationAsRead } from '@/api/notification'
import type { IAllNotificationRequest } from '@/types/notification.type'
import { useNotificationStore } from '@/stores/notification.store'

const NOTIFICATION_QUERY_KEY = 'notifications'

export function useNotifications(
  params: IAllNotificationRequest,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [NOTIFICATION_QUERY_KEY, params],
    queryFn: () => getNotifications(params),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  })
}

export function useMarkNotificationAsRead() {
  return useMutation({
    mutationFn: (slug: string) => markNotificationAsRead(slug),
    onMutate: (slug) => {
      // Optimistic: mark as read in local store immediately.
      // No onSuccess invalidation — the local store is the source of truth here;
      // server state will sync naturally on the next page load / pull-to-refresh.
      const prev = useNotificationStore
        .getState()
        .notifications.find((n) => n.slug === slug)
      useNotificationStore.getState().markAsRead(slug)
      // Return previous isRead for rollback in onError
      return { slug, wasRead: prev?.isRead ?? false }
    },
    onError: (_err, _slug, context) => {
      if (context && !context.wasRead) {
        useNotificationStore
          .getState()
          .setReadStates([{ slug: context.slug, isRead: false }])
      }
    },
  })
}
