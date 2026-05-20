/**
 * Notification Store — in-memory list of received notifications (max 50).
 *
 * addNotification: parse FCM payload → INotification → prepend to list
 * markAsRead / markAllAsRead: optimistic local update
 * hydrateFromApi: merge API data into local store (API takes priority)
 * unreadCount: cached primitive updated atomically in each mutator (O(1) reads)
 */
import { create } from 'zustand'
import * as Notifications from 'expo-notifications'

import type {
  INotification,
  INotificationMetadata,
} from '@/types/notification.type'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  notification?: {
    title?: string
    body?: string
    icon?: string
    image?: string
  }
  data?: Record<string, string>
  messageId?: string
}

interface NotificationStore {
  notifications: INotification[]
  /** ISO timestamp — mọi notification có createdAt ≤ giá trị này được coi là đã đọc. */
  markedAllReadAt: string | null
  /** Cached unread count — updated atomically in each mutator. O(1) to read. */
  unreadCount: number
  addNotification: (
    payload: NotificationPayload,
    options?: { markAsRead?: boolean },
  ) => void
  markAsRead: (slug: string) => void
  markAllReadByOrder: (orderSlug: string) => void
  markAllAsRead: () => void
  setReadStates: (updates: { slug: string; isRead: boolean }[]) => void
  clearAll: () => void
  hydrateFromApi: (items: INotification[]) => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_NOTIFICATIONS = 50

function transformPayloadToNotification(
  payload: NotificationPayload,
  markAsRead = false,
): INotification {
  const data = payload.data ?? {}

  // Parse data.payload JSON string (backend sends metadata here)
  let parsedPayload: Record<string, string> = {}
  if (data.payload && typeof data.payload === 'string') {
    try {
      parsedPayload = JSON.parse(data.payload) as Record<string, string>
    } catch {
      // Ignore parse errors
    }
  }

  // Merge: parsed payload takes priority over raw data
  const merged = { ...data, ...parsedPayload }

  const slug = merged.slug || data.slug || payload.messageId || `${Date.now()}`
  const createdAt =
    merged.createdAt || data.createdAt || new Date().toISOString()
  const message =
    merged.message || data.message || payload.notification?.body || ''
  const type = merged.type || data.type || 'system'

  const metadata: INotificationMetadata = {
    order: merged.order || '',
    orderType: merged.orderType || '',
    tableName: merged.tableName || '',
    table: merged.table || '',
    branchName: merged.branchName || '',
    branch: merged.branch || '',
    referenceNumber: merged.referenceNumber || '',
    createdAt: merged.createdAt || data.createdAt || createdAt,
    cardOrder: merged.cardOrder || merged.cardOrderSlug || '',
    cardOrderCode: merged.cardOrderCode || '',
  }

  return {
    slug,
    createdAt,
    message,
    senderId: merged.senderId || '',
    receiverId: merged.receiverId || '',
    type,
    isRead: markAsRead,
    metadata,
  }
}

// ─── Helpers (continued) ────────────────────────────────────────────────────

// Debounced badge sync — collapses bursts (e.g. FCM hydrate + bulk mark-read)
// into a single native call. 200ms trailing window: imperceptible to the user,
// eliminates redundant bridge round-trips.
let _badgeTimer: ReturnType<typeof setTimeout> | null = null
let _pendingBadgeCount = 0

function syncBadge(count: number): void {
  _pendingBadgeCount = count
  if (_badgeTimer) return
  _badgeTimer = setTimeout(() => {
    _badgeTimer = null
    Notifications.setBadgeCountAsync(_pendingBadgeCount).catch(() => {})
  }, 200)
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  markedAllReadAt: null,
  unreadCount: 0,

  addNotification: (payload, options) => {
    set((state) => {
      const rawItem = transformPayloadToNotification(
        payload,
        options?.markAsRead ?? false,
      )
      const existing = state.notifications.find((n) => n.slug === rawItem.slug)
      // Preserve read state: a notification already read locally must not be
      // reset to unread by a duplicate FCM delivery.
      const item =
        existing?.isRead === true ? { ...rawItem, isRead: true } : rawItem
      const filtered = state.notifications.filter((n) => n.slug !== item.slug)
      const updated = [item, ...filtered].slice(0, MAX_NOTIFICATIONS)
      let unreadCount = 0
      for (const n of updated) if (!n.isRead) unreadCount++
      return { notifications: updated, unreadCount }
    })
    syncBadge(get().unreadCount)
  },

  markAsRead: (slug) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.slug === slug ? { ...n, isRead: true } : n,
      )
      let unreadCount = 0
      for (const n of notifications) if (!n.isRead) unreadCount++
      return { notifications, unreadCount }
    })
    syncBadge(get().unreadCount)
  },

  markAllReadByOrder: (orderSlug) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.metadata.order === orderSlug ? { ...n, isRead: true } : n,
      )
      let unreadCount = 0
      for (const n of notifications) if (!n.isRead) unreadCount++
      return { notifications, unreadCount }
    })
    syncBadge(get().unreadCount)
  },

  markAllAsRead: () => {
    const ts = new Date().toISOString()
    set((state) => ({
      markedAllReadAt: ts,
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }))
    syncBadge(0)
  },

  setReadStates: (updates) => {
    const map = new Map(updates.map((u) => [u.slug, u.isRead]))
    set((state) => {
      const notifications = state.notifications.map((n) =>
        map.has(n.slug) ? { ...n, isRead: map.get(n.slug)! } : n,
      )
      let unreadCount = 0
      for (const n of notifications) if (!n.isRead) unreadCount++
      return { notifications, unreadCount }
    })
    syncBadge(get().unreadCount)
  },

  clearAll: () => {
    set({ notifications: [], markedAllReadAt: null, unreadCount: 0 })
    syncBadge(0)
  },

  hydrateFromApi: (items) => {
    if (!items || items.length === 0) return
    set((state) => {
      const { markedAllReadAt } = state

      // If the incoming items belong to a different user than what's in the
      // store, replace entirely — never merge another user's notifications.
      const incomingReceiver = items[0]?.receiverId
      const storedReceiver = state.notifications[0]?.receiverId
      const isDifferentUser =
        !!incomingReceiver &&
        !!storedReceiver &&
        incomingReceiver !== storedReceiver

      // Build single map: seed with current local state (preserves optimistic
      // reads), then overlay incoming server items. Skip seeding when the store
      // belongs to a different account so stale data doesn't leak through.
      const map = new Map<string, INotification>()
      if (!isDifferentUser) {
        for (const n of state.notifications) map.set(n.slug, n)
      }
      for (const n of items) {
        const local = map.get(n.slug)

        // isRead priority (highest → lowest):
        // 1. Local already marked read (optimistic individual/bulk)
        // 2. createdAt ≤ markedAllReadAt → bulk-read timestamp covers it
        // 3. Server value
        const bulkCovered = !!markedAllReadAt && n.createdAt <= markedAllReadAt
        const isRead = local?.isRead === true || bulkCovered || n.isRead

        map.set(n.slug, { ...n, isRead })
      }
      const merged = Array.from(map.values())
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, MAX_NOTIFICATIONS)
      let unreadCount = 0
      for (const n of merged) if (!n.isRead) unreadCount++
      return {
        notifications: merged,
        unreadCount,
        // Reset markedAllReadAt when switching accounts — the bulk-read
        // timestamp from account A must not bleed into account B's data.
        ...(isDifferentUser ? { markedAllReadAt: null } : {}),
      }
    })
    syncBadge(get().unreadCount)
  },
}))
