/**
 * Store cho expanded note IDs trong Cart — tránh re-render toàn list khi expand/collapse.
 * CartItemRow subscribe ids.has(item.id) → chỉ row đó re-render.
 */
import { create } from 'zustand'

interface ExpandedCartNotesStore {
  ids: Set<string>
  toggle: (id: string) => void
  clear: () => void
}

export const useExpandedCartNotesStore = create<ExpandedCartNotesStore>(
  (set) => ({
    ids: new Set(),
    toggle: (id: string) => {
      set((state) => {
        const next = new Set(state.ids)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return { ids: next }
      })
    },
    clear: () => set({ ids: new Set() }),
  }),
)

/** T7: Selector primitive — chỉ re-render khi boolean đổi, tránh cascade */
export const useIsExpandedCartNote = (itemId: string): boolean =>
  useExpandedCartNotesStore((s) => s.ids.has(itemId))
