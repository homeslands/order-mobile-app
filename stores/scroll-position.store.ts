/**
 * Lưu scroll position theo tab — dùng khi detachInactiveScreens=true.
 * Khi tab unmount, scroll mất; khi focus lại cần restore từ store.
 */
import { create } from 'zustand'

export type TabScrollKey = 'home' | 'menu' | 'profile' | 'cart'

type ScrollPositionStore = {
  positions: Record<TabScrollKey, number>
  save: (tab: TabScrollKey, y: number) => void
  get: (tab: TabScrollKey) => number
}

export const useScrollPositionStore = create<ScrollPositionStore>(
  (set, get) => ({
    positions: { home: 0, menu: 0, profile: 0, cart: 0 },
    save: (tab, y) =>
      set((s) => ({
        positions: { ...s.positions, [tab]: Math.max(0, y) },
      })),
    get: (tab) => get().positions[tab] ?? 0,
  }),
)
