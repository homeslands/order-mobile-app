/**
 * Notification Store — in-memory list of received notifications (max 50).
 *
 * addNotification: parse FCM payload → INotification → prepend to list
 * markAsRead / markAllAsRead: optimistic local update
 * hydrateFromApi: merge API data into local store (API takes priority)
 * getUnreadCount: derived count
 */
import { create } from 'zustand'

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
  addNotification: (
    payload: NotificationPayload,
    options?: { markAsRead?: boolean },
  ) => void
  markAsRead: (slug: string) => void
  markAllAsRead: () => void
  setReadStates: (updates: { slug: string; isRead: boolean }[]) => void
  clearAll: () => void
  getUnreadCount: () => number
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

  const slug =
    merged.slug || data.slug || payload.messageId || `${Date.now()}`
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

// ─── Store ──────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  markedAllReadAt: null,

  addNotification: (payload, options) => {
    set((state) => {
      const item = transformPayloadToNotification(
        payload,
        options?.markAsRead ?? false,
      )
      // Dedup by slug, prepend new, cap at MAX
      const filtered = state.notifications.filter(
        (n) => n.slug !== item.slug,
      )
      return { notifications: [item, ...filtered].slice(0, MAX_NOTIFICATIONS) }
    })
  },

  markAsRead: (slug) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.slug === slug ? { ...n, isRead: true } : n,
      ),
    }))
  },

  markAllAsRead: () => {
    const ts = new Date().toISOString()
    set((state) => ({
      markedAllReadAt: ts,
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }))
  },

  setReadStates: (updates) => {
    const map = new Map(updates.map((u) => [u.slug, u.isRead]))
    set((state) => ({
      notifications: state.notifications.map((n) =>
        map.has(n.slug) ? { ...n, isRead: map.get(n.slug)! } : n,
      ),
    }))
  },

  clearAll: () => set({ notifications: [], markedAllReadAt: null }),

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.isRead).length
  },

  hydrateFromApi: (items) => {
    if (!items || items.length === 0) return
    set((state) => {
      const { markedAllReadAt } = state

      // Build single map seeded with current local state, then overlay incoming
      // server items. Local isRead always wins (optimistic markings) — see
      // priority comment below.
      const map = new Map<string, INotification>()
      for (const n of state.notifications) map.set(n.slug, n)
      for (const n of items) {
        const local = map.get(n.slug)

        // isRead priority (highest → lowest):
        // 1. Local already marked read (optimistic individual/bulk)
        // 2. createdAt ≤ markedAllReadAt → bulk-read timestamp covers it
        // 3. Server value
        const bulkCovered =
          !!markedAllReadAt && n.createdAt <= markedAllReadAt
        const isRead = local?.isRead === true || bulkCovered || n.isRead

        map.set(n.slug, { ...n, isRead })
      }
      const merged = Array.from(map.values())
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, MAX_NOTIFICATIONS)
      return { notifications: merged }
    })
  },
}))
